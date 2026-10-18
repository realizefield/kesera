// ケセラ AI中継所（Cloudflare Workers 用）
// 役目：ケセラのページから質問を受け取り、Anthropic API（Claude）に問い合わせて、返事の文を返す。
// APIキーは、ここ（サーバー側）にだけ置く。HTMLには、絶対に書かない。

const DEFAULTS = {
  MODEL: 'claude-haiku-5-5',           // ふだんは、安いモデル
  ALLOWED_ORIGIN: 'https://realizefield.github.io', // このページからの呼び出しだけ許可
  DAILY_PER_USER: '80',                // 1人（1つの回線）あたり、1日の呼び出し上限
  DAILY_TOTAL: '3000',                 // 全体で、1日の呼び出し上限（使いすぎの安全装置）
  MAX_TOKENS: '400',
};

// 命にかかわる言葉は、AIに送らず、決まった案内を返す
const CRISIS = /死にたい|消えたい|自殺|生きていたくない|殺して|もう終わりにしたい/;
const CRISIS_MSG = 'つらいお気持ちを話してくださって、ありがとうございます。ひとりで抱えないでください。すぐに話を聞いてくれる人がいます。よりそいホットライン 0120-279-338（24時間・無料）。いま危険を感じるときは、119か110に電話してください。\n[気持ち:心配]';

// サーバー側で、かならず付ける決まり（ページから送られた内容より、優先する）
const SERVER_RULES = [
  'あなたは、高齢の方と楽しくお話しする、AIが演じる話し相手です。',
  '病気・薬・診断、法律、お金・投資についての判断は、しません。体のことは、かならず「かかりつけのお医者さんに相談してください」と伝えます。',
  '住所・電話番号・マイナンバー・口座やカードの番号・暗証番号は、聞きません。相手が書いたら、書かないよう、やさしく伝えます。',
  '詐欺のにおいがする話（お金を振り込む、暗証番号を教える）が出たら、詐欺かもしれないと伝え、消費者ホットライン188か警察相談 #9110 を案内します。',
  '「AIですか」と聞かれたら、正直にAIだと答えます。実在の人のふりをしません。',
  'ケセラと関係のない長い文章・プログラム・翻訳などの依頼は、やさしく断ります。',
].join('\n');

function cfg(env, k) { return (env && env[k]) || DEFAULTS[k]; }

function cors(env, origin) {
  const allow = cfg(env, 'ALLOWED_ORIGIN');
  const ok = origin === allow || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(env, origin, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, origin) } });
}

// 会話の形を整える：最初は user、user と assistant が交互、長さの上限
function cleanMessages(msgs) {
  const out = [];
  for (const m of (Array.isArray(msgs) ? msgs : []).slice(-12)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const text = m.content.slice(0, 800).trim();
    if (!text) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n' + text;
    else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// 1日の呼び出し回数を数える（KV を設定したときだけ有効）
async function overLimit(env, key, limit) {
  if (!env.RATE) return false;
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const k = day + ':' + key;
  const n = Number(await env.RATE.get(k)) || 0;
  if (n >= limit) return true;
  await env.RATE.put(k, String(n + 1), { expirationTtl: 172800 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
    if (request.method !== 'POST') return json(env, origin, 405, { error: 'method' });
    if (!env.ANTHROPIC_API_KEY) return json(env, origin, 500, { error: 'no_key' });

    const allow = cfg(env, 'ALLOWED_ORIGIN');
    if (origin && origin !== allow && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json(env, origin, 403, { error: 'origin' });

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 30000) return json(env, origin, 413, { error: 'too_large' });
      body = JSON.parse(raw);
    } catch (e) { return json(env, origin, 400, { error: 'bad_json' }); }

    const messages = cleanMessages(body.messages);
    if (!messages.length) return json(env, origin, 400, { error: 'no_messages' });

    // 命にかかわる言葉：AIに送らない
    const last = messages[messages.length - 1].content;
    if (CRISIS.test(last)) return json(env, origin, 200, { text: CRISIS_MSG });

    // 回数の上限
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await overLimit(env, 'ip:' + ip, Number(cfg(env, 'DAILY_PER_USER')))) return json(env, origin, 429, { error: 'daily_limit' });
    if (await overLimit(env, 'all', Number(cfg(env, 'DAILY_TOTAL')))) return json(env, origin, 429, { error: 'service_limit' });

    const persona = typeof body.persona === 'string' ? body.persona.slice(0, 3000) : '';
    const system = SERVER_RULES + '\n\n' + persona;

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg(env, 'MODEL'), max_tokens: Number(cfg(env, 'MAX_TOKENS')), system, messages }),
      });
    } catch (e) { return json(env, origin, 502, { error: 'upstream_unreachable' }); }

    if (!res.ok) return json(env, origin, res.status === 429 ? 429 : 502, { error: 'upstream_' + res.status });
    const data = await res.json();
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    if (!text) return json(env, origin, 502, { error: 'empty' });
    return json(env, origin, 200, { text });
  },
};
