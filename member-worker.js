// 四毒抜きレシピ帳 会員の中継所（Cloudflare Workers 用）
// 役目：無料会員の登録・ログイン、料理ノートなどの記録の保存（別の端末でも同じ記録を見られるように）、
//       会員数や関心の集計。メールアドレスは集めません（ニックネームと合言葉だけ）。
//
// 設定（Cloudflare の画面で行います）
//   1. KV を作り、この Worker に「MEMBERS」という名前で結びつける（バインディング）
//   2. 変数（シークレット）「ADMIN_KEY」に、自分だけが知る長い文字を入れる（集計ページを見るため）
//   3. 変数「ALLOWED_ORIGIN」は、通常は変更不要（https://realizefield.github.io）

const DEFAULTS = { ALLOWED_ORIGIN: 'https://realizefield.github.io' };
const TOKEN_TTL = 90 * 86400;      // ログインの有効期間：90日
const MAX_DATA = 200000;           // 1人の保存データの上限（文字数）
const EV_TYPES = ['recipe', 'lesson', 'hitoiki', 'page'];

const enc = new TextEncoder();
const cfg = (env, k) => (env && env[k]) || DEFAULTS[k];

function cors(env, origin) {
  const allow = cfg(env, 'ALLOWED_ORIGIN');
  const ok = origin === allow || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(env, origin, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, origin) } });
}
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function derive(secret, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: 100000 }, key, 256);
  return hex(bits);
}
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ニックネームの正規化（全角・半角、大文字・小文字、空白のちがいを同じ扱いに）
function nickKey(nick) { return String(nick || '').normalize('NFKC').trim().replace(/\s+/g, '').toLowerCase(); }
function nickOk(nick) {
  const n = String(nick || '').normalize('NFKC').trim();
  return n.length >= 2 && n.length <= 12 && !/[\u0000-\u001f<>"'&]/.test(n);
}
function passOk(p) { return typeof p === 'string' && p.length >= 4 && p.length <= 40; }
function newRecovery() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 読み間違えやすい文字（O, 0, I, 1）は使わない
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(r).map((b) => A[b % A.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
}
const day = (off = 0) => new Date(Date.now() + 9 * 3600e3 - off * 86400e3).toISOString().slice(0, 10);

async function tooMany(env, key) { return (Number(await env.MEMBERS.get('f:' + key)) || 0) >= 8; }
async function addFail(env, key) {
  const n = (Number(await env.MEMBERS.get('f:' + key)) || 0) + 1;
  await env.MEMBERS.put('f:' + key, String(n), { expirationTtl: 900 });
}
async function newToken(env, nk) {
  const t = randHex(32);
  await env.MEMBERS.put('t:' + t, nk, { expirationTtl: TOKEN_TTL });
  return t;
}
async function whoIs(env, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const nk = await env.MEMBERS.get('t:' + token);
  if (!nk) return null;
  const m = await env.MEMBERS.get('m:' + nk, 'json');
  return m ? { nk, m } : null;
}
async function touch(env, nk) { await env.MEMBERS.put('a:' + day() + ':' + nk, '1', { expirationTtl: 40 * 86400 }); }
async function countPrefix(env, prefix) {
  let n = 0, cursor;
  do {
    const r = await env.MEMBERS.list({ prefix, cursor });
    n += r.keys.length; cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return n;
}

async function handle(request, env, url, origin) {
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/stats' && request.method === 'GET') return stats(env, url);

  if (request.method !== 'POST') return json(env, origin, 405, { error: 'method' });
  let b;
  try { b = await request.json(); } catch (e) { return json(env, origin, 400, { error: 'bad' }); }

  if (path === '/register') {
    if (!nickOk(b.nick)) return json(env, origin, 400, { error: 'nick' });
    if (!passOk(b.pass)) return json(env, origin, 400, { error: 'pass' });
    const nk = nickKey(b.nick);
    if (await env.MEMBERS.get('m:' + nk)) return json(env, origin, 409, { error: 'taken' });
    const salt = randHex(16), rsalt = randHex(16), rec = newRecovery();
    const m = {
      nick: String(b.nick).normalize('NFKC').trim(), salt, hash: await derive(b.pass, salt),
      rsalt, rhash: await derive(rec.replace(/-/g, ''), rsalt), created: day(),
    };
    await env.MEMBERS.put('m:' + nk, JSON.stringify(m));
    await touch(env, nk);
    return json(env, origin, 200, { token: await newToken(env, nk), nick: m.nick, recovery: rec });
  }

  if (path === '/login') {
    const nk = nickKey(b.nick);
    if (!nk || !passOk(b.pass)) return json(env, origin, 400, { error: 'bad' });
    if (await tooMany(env, nk)) return json(env, origin, 429, { error: 'locked' });
    const m = await env.MEMBERS.get('m:' + nk, 'json');
    if (!m || !same(await derive(b.pass, m.salt), m.hash)) { await addFail(env, nk); return json(env, origin, 401, { error: 'login' }); }
    await touch(env, nk);
    return json(env, origin, 200, { token: await newToken(env, nk), nick: m.nick });
  }

  if (path === '/reset') {
    const nk = nickKey(b.nick);
    if (!nk || typeof b.recovery !== 'string' || !passOk(b.pass)) return json(env, origin, 400, { error: 'bad' });
    if (await tooMany(env, nk)) return json(env, origin, 429, { error: 'locked' });
    const m = await env.MEMBERS.get('m:' + nk, 'json');
    const code = b.recovery.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!m || !same(await derive(code, m.rsalt), m.rhash)) { await addFail(env, nk); return json(env, origin, 401, { error: 'recovery' }); }
    m.salt = randHex(16); m.hash = await derive(b.pass, m.salt);
    await env.MEMBERS.put('m:' + nk, JSON.stringify(m));
    await touch(env, nk);
    return json(env, origin, 200, { token: await newToken(env, nk), nick: m.nick });
  }

  const me = await whoIs(env, b.token);
  if (!me) return json(env, origin, 401, { error: 'auth' });

  if (path === '/get') {
    const d = await env.MEMBERS.get('d:' + me.nk);
    await touch(env, me.nk);
    return json(env, origin, 200, { data: d || '' });
  }
  if (path === '/put') {
    if (typeof b.data !== 'string' || b.data.length > MAX_DATA) return json(env, origin, 400, { error: 'size' });
    try { JSON.parse(b.data); } catch (e) { return json(env, origin, 400, { error: 'bad' }); }
    await env.MEMBERS.put('d:' + me.nk, b.data);
    await touch(env, me.nk);
    return json(env, origin, 200, { ok: true });
  }
  if (path === '/ev') {
    if (!EV_TYPES.includes(b.t) || typeof b.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(b.id)) return json(env, origin, 400, { error: 'bad' });
    const k = 'c:' + b.t + ':' + b.id;
    await env.MEMBERS.put(k, String((Number(await env.MEMBERS.get(k)) || 0) + 1));
    await touch(env, me.nk);
    return json(env, origin, 200, { ok: true });
  }
  if (path === '/delete') {
    if (!passOk(b.pass) || !same(await derive(b.pass, me.m.salt), me.m.hash)) return json(env, origin, 401, { error: 'login' });
    await env.MEMBERS.delete('m:' + me.nk);
    await env.MEMBERS.delete('d:' + me.nk);
    return json(env, origin, 200, { ok: true });
  }
  return json(env, origin, 404, { error: 'path' });
}

async function stats(env, url) {
  const h = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!env.ADMIN_KEY || !same(url.searchParams.get('key') || '', env.ADMIN_KEY)) return new Response('見られません', { status: 403, headers: h });
  const members = await countPrefix(env, 'm:');
  const days = [];
  for (let i = 0; i < 7; i++) days.push([day(i), await countPrefix(env, 'a:' + day(i) + ':')]);
  const ev = [];
  let cursor;
  do {
    const r = await env.MEMBERS.list({ prefix: 'c:', cursor });
    for (const k of r.keys) ev.push([k.name.slice(2), Number(await env.MEMBERS.get(k.name)) || 0]);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  ev.sort((a, b) => b[1] - a[1]);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>会員の集計</title>' +
    '<body style="font-family:sans-serif;max-width:640px;margin:16px auto;padding:0 16px;line-height:1.8;font-size:18px">' +
    '<h1>会員の集計</h1><p><b>会員の数：' + members + '人</b></p><h2>この7日間に使った会員の数</h2><ul>' +
    days.map((d) => '<li>' + d[0] + '：' + d[1] + '人</li>').join('') + '</ul><h2>よく見られているページ（上位30）</h2><ol>' +
    ev.slice(0, 30).map((e) => '<li>' + esc(e[0]) + '：' + e[1] + '回</li>').join('') + '</ol>' +
    '<p style="color:#555;font-size:15px">recipe＝レシピ、lesson＝料理への道の学び、hitoiki＝ちょっとひといき、page＝そのほかのページ。このページのアドレスは、他の人に教えないでください。</p></body>';
  return new Response(html, { status: 200, headers: h });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
    if (!env.MEMBERS) return json(env, origin, 500, { error: 'no_kv' });
    const allow = cfg(env, 'ALLOWED_ORIGIN');
    if (origin && origin !== allow && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json(env, origin, 403, { error: 'origin' });
    try { return await handle(request, env, new URL(request.url), origin); }
    catch (e) { return json(env, origin, 500, { error: 'server' }); }
  },
};
