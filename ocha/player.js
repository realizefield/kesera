/* ほっとひと息：お茶の豆知識（音声で聞く／文で読む／ケセラセラを聞く）
   読み込み: ocha/script.js（原稿データ）, ocha/audio/sNN_MM.wav（VOICEVOX:四国めたん。無い場合はブラウザ音声で代用） */
(function () {
  'use strict';
  var D, S, MAIN, EX = -1, total = 0, ready = null;
  function $(id) { return document.getElementById(id); }
  function E(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var BASE = (function () { var s = document.currentScript; return s && s.src ? s.src.replace(/[^\/]*$/, '') : 'ocha/'; })();

  function load() {
    if (ready) return ready;
    ready = new Promise(function (res, rej) {
      if (window.OCHA_SCRIPT) return res();
      var s = document.createElement('script'); s.src = BASE + 'script.js';
      s.onload = res; s.onerror = function () { ready = null; rej(new Error('script')); };
      document.head.appendChild(s);
    }).then(function () {
      D = window.OCHA_SCRIPT; S = D.slides;
      MAIN = S.filter(function (x) { return !x.extra; }).length;
      S.forEach(function (x, i) { if (x.extra) EX = i; total += x.lines.length; });
    });
    return ready;
  }

  var RUBY = /\{([^|{}]+)\|([^|{}]*)(?:\|([^{}]*))?\}/g;
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function html(raw) { var out = '', last = 0; raw.replace(RUBY, function (m, b, y, v, off) { out += esc(raw.slice(last, off)); out += (y === '-') ? esc(b) : '<ruby>' + esc(b) + '<rt>' + esc(y) + '</rt></ruby>'; last = off + m.length; return m; }); return out + esc(raw.slice(last)); }
  function voice(raw) { return raw.replace(RUBY, function (m, b, y, v) { return v !== undefined ? v : y; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function songUrl() { var k = (D && D.kesera) || {}; return k.url ? k.url : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(k.search || 'ケセラセラ ドリス・デイ 日本語字幕'); }
  function title(s, i) { return (s.extra ? '蛇足' : (i + 1)) + '. ' + s.title.replace(/[「」？]/g, ''); }

  var CSS = [
    '.oc-st{position:fixed;inset:0;background:#f6f0e0;display:none;flex-direction:column;z-index:100000;color:#2b3340;font-family:inherit}',
    '.oc-st.on{display:flex}',
    '.oc-top{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#e9efdc;border-bottom:1px solid #d3e4c3}',
    '.oc-top .t{font-weight:800;flex:1;font-size:1rem}',
    '.oc-top button,.oc-ctrl button,.oc-ph button{border:0;background:#fff;border-radius:10px;padding:10px 14px;font-size:1rem;cursor:pointer;box-shadow:0 1px 3px #0003;color:#2b3340;min-height:44px}',
    '.oc-bar{height:5px;background:#dfe7d0}.oc-bar i{display:block;height:100%;width:0;background:#a3395f;transition:width .3s}',
    '.oc-main{flex:1;overflow:auto;padding:20px 16px 12px}.oc-sl{max-width:900px;margin:0 auto}',
    '.oc-chap{color:#5b7f3a;font-weight:800;font-size:.95rem}',
    '.oc-ti{font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.35;margin:6px 0 16px;display:flex;align-items:center;gap:12px}',
    '.oc-ti svg{flex:none}',
    '.oc-steam{animation:ocst 3s ease-in-out infinite}.oc-steam:nth-child(2){animation-delay:.6s}.oc-steam:nth-child(3){animation-delay:1.2s}',
    '@keyframes ocst{0%,100%{opacity:.15}50%{opacity:.9}}',
    '.oc-facts{list-style:none;padding:0;margin:0;display:grid;gap:10px}',
    '.oc-facts li{background:#fff;border-left:6px solid #5b7f3a;border-radius:8px;padding:12px 16px;font-size:clamp(1.05rem,3.2vw,1.35rem);line-height:1.6;box-shadow:0 1px 3px #0000000f}',
    '.oc-ctrl{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:10px 12px}',
    '.oc-ctrl .play{background:#a3395f;color:#fff;min-width:120px;font-weight:800}',
    '.oc-ctrl select{padding:10px;border-radius:8px;border:1px solid #bbb;max-width:230px;font-size:.95rem}',
    '.oc-ctrl label{font-size:.95rem}',
    '.oc-ft{text-align:center;font-size:.78rem;color:#555;padding:0 10px 10px}',
    '.oc-bd{display:inline-block;background:#fff;border-radius:99px;padding:2px 10px;margin-right:6px}',
    '.oc-link{display:block;margin:14px auto 0;max-width:420px;text-align:center;text-decoration:none;background:#fff;color:#a3395f;border:2px solid #a3395f;border-radius:12px;padding:13px;font-size:1.1rem;font-weight:800;cursor:pointer}',
    '.oc-rd{position:fixed;inset:0;background:#0000008c;display:none;align-items:center;justify-content:center;z-index:100001;padding:12px}',
    '.oc-rd.on{display:flex}',
    '.oc-pop{background:#fffdf8;border-radius:16px;max-width:820px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px #0005;color:#2b3340}',
    '.oc-ph{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #d3e4c3;background:#e9efdc;border-radius:16px 16px 0 0}',
    '.oc-ph select{flex:1;min-width:150px;padding:10px;border-radius:8px;border:1px solid #bbb;font-size:.95rem}',
    '.oc-pb{padding:16px 20px 24px;overflow:auto;line-height:2}',
    '.oc-pb h2{font-size:1.3em;margin:0 0 12px;line-height:1.4}',
    '.oc-pb ul{margin:0 0 16px;padding:12px 16px 12px 32px;background:#f1f7ec;border-radius:10px;font-size:.92em;line-height:1.7}',
    '.oc-pb p{margin:0}.oc-pb rt{font-size:.5em}',
    '.oc-pf{display:flex;justify-content:space-between;gap:8px;padding:10px 14px;border-top:1px solid #d3e4c3}',
    '.oc-pf button{border:0;border-radius:10px;background:#a3395f;color:#fff;padding:11px 16px;font-size:1rem;font-weight:800;cursor:pointer;min-height:44px}',
    '.oc-pf button:disabled{opacity:.35}'
  ].join('\n');

  var CUP = '<svg width="60" height="50" viewBox="0 0 120 100" aria-hidden="true"><path d="M20 40h70v20a35 30 0 0 1-70 0z" fill="#fff" stroke="#5b7f3a" stroke-width="5"/><path d="M90 46h10a12 12 0 0 1 0 24h-12" fill="none" stroke="#5b7f3a" stroke-width="5"/><path class="oc-steam" d="M42 32c-7-8 7-12 0-22" fill="none" stroke="#9aa88a" stroke-width="4" stroke-linecap="round"/><path class="oc-steam" d="M60 32c-7-8 7-12 0-22" fill="none" stroke="#9aa88a" stroke-width="4" stroke-linecap="round"/><path class="oc-steam" d="M78 32c-7-8 7-12 0-22" fill="none" stroke="#9aa88a" stroke-width="4" stroke-linecap="round"/></svg>';

  var st = { si: 0, li: 0, playing: false, tok: 0, mode: null, drawn: -1 }, player = null, stopRes = null, built = false, rIdx = 0, rSize = 19;

  function build() {
    if (built) return; built = true;
    var css = E('style'); css.textContent = CSS; document.head.appendChild(css);
    var w = E('div'); w.innerHTML =
      '<div class="oc-st" id="ocStage" role="dialog" aria-modal="true" aria-label="お茶の豆知識">' +
      '<div class="oc-top"><div class="t" id="ocTtl">お茶の豆知識</div><button type="button" id="ocClose">✕ 閉じる</button></div>' +
      '<div class="oc-bar"><i id="ocProg"></i></div>' +
      '<div class="oc-main"><div class="oc-sl" id="ocSlide"></div></div>' +
      '<div class="oc-ctrl"><button type="button" id="ocPS" title="前の話">⏮</button><button type="button" id="ocPL" title="ひとつ前の文">◀</button>' +
      '<button type="button" class="play" id="ocPlay">▶ 再生</button><button type="button" id="ocNL" title="次の文">▶</button><button type="button" id="ocNS" title="次の話">⏭</button>' +
      '<select id="ocChap" aria-label="話を選ぶ"></select>' +
      '<select id="ocRate" aria-label="読む速さ"><option value="0.9">ゆっくり</option><option value="1" selected>ふつう</option><option value="1.15">はやめ</option></select>' +
      '<label><input type="checkbox" id="ocAuto" checked> 自動で次へ</label></div>' +
      '<div class="oc-ft"><span class="oc-bd" id="ocMode">音声：未再生</span>音声：VOICEVOX:四国めたん</div></div>' +
      '<div class="oc-rd" id="ocReader" role="dialog" aria-modal="true" aria-label="文で読む"><div class="oc-pop">' +
      '<div class="oc-ph"><select id="ocRSel" aria-label="話を選ぶ"></select><button type="button" id="ocRSm">A−</button><button type="button" id="ocRLg">A＋</button><button type="button" id="ocRClose">✕ 閉じる</button></div>' +
      '<div class="oc-pb" id="ocRBody"></div>' +
      '<div class="oc-pf"><button type="button" id="ocRPrev">◀ 前の話</button><button type="button" id="ocRNext">次の話 ▶</button></div></div></div>';
    while (w.firstChild) document.body.appendChild(w.firstChild);
    player = new Audio();
    S.forEach(function (s, i) { ['ocChap', 'ocRSel'].forEach(function (id) { var o = E('option', '', title(s, i)); o.value = i; $(id).appendChild(o); }); });
    wire();
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rate() { return parseFloat($('ocRate').value); }
  function drawSlide() {
    if (st.drawn === st.si) return; st.drawn = st.si; var s = S[st.si];
    $('ocSlide').innerHTML = '<div class="oc-chap">' + (s.extra ? '蛇足（おまけ）' : '第' + (st.si + 1) + '話 ／ 全' + MAIN + '話') + '</div><h1 class="oc-ti">' + CUP + '<span>' + html(s.title) + '</span></h1><ul class="oc-facts">' + s.facts.map(function (f) { return '<li>' + html(f) + '</li>'; }).join('') + '</ul>' +
      ((EX >= 0 && (s.id === 'kissako1' || s.id === 'owari')) ? '<button type="button" class="oc-link" data-extra="1">📿 野田の説明を聞く（蛇足）</button>' : '') +
      (s.id === 'owari' ? '<a class="oc-link" target="_blank" rel="noopener" href="' + songUrl() + '">🎵 ケセラセラを聞く</a>' : '');
    $('ocChap').value = st.si; $('ocTtl').textContent = 'お茶の豆知識　' + (s.extra ? '蛇足' : (st.si + 1) + ' / ' + MAIN);
    document.querySelector('#ocStage .oc-main').scrollTop = 0;
  }
  function drawProg() { var done = 0; for (var i = 0; i < st.si; i++) done += S[i].lines.length; $('ocProg').style.width = ((done + st.li + 1) / total * 100) + '%'; }
  function stopSound() {
    try { player.pause(); } catch (e) {} if (window.speechSynthesis) speechSynthesis.cancel();
    if (stopRes) { var r = stopRes; stopRes = null; r(); }
  }
  function playFile(url) {
    return new Promise(function (res, rej) {
      var done = false; function fin(f) { if (done) return; done = true; stopRes = null; player.onended = player.onerror = null; f(); }
      stopRes = function () { fin(res); };
      player.onended = function () { fin(res); }; player.onerror = function () { fin(function () { rej(new Error('nofile')); }); };
      player.src = url; player.playbackRate = rate();
      var p = player.play(); if (p && p.catch) p.catch(function () { fin(function () { rej(new Error('blocked')); }); });
    });
  }
  function ttsVoice() { var v = speechSynthesis.getVoices().filter(function (x) { return /^ja/i.test(x.lang); }); return v.filter(function (x) { return /female|kyoko|haruka|nanami|ayumi|google/i.test(x.name); })[0] || v[0] || null; }
  function speakTTS(text) {
    return new Promise(function (res) {
      if (!window.speechSynthesis) { sleep(Math.max(2000, text.length * 220)).then(res); return; }
      var u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = rate() * 0.95; var v = ttsVoice(); if (v) u.voice = v;
      var done = false; function fin() { if (done) return; done = true; stopRes = null; res(); }
      u.onend = fin; u.onerror = fin; stopRes = fin; speechSynthesis.cancel(); speechSynthesis.speak(u);
    });
  }
  function setMode(m) { st.mode = m; $('ocMode').textContent = (m === 'file') ? '音声：VOICEVOX（四国めたん）' : '音声：ブラウザ音声（仮）'; }
  async function speak(raw, my) {
    if (raw.charAt(0) === '【') { await sleep(2800); return; }
    var url = BASE + 'audio/s' + pad(st.si + 1) + '_' + pad(st.li + 1) + '.wav';
    if (st.mode !== 'tts') {
      try { await playFile(url); if (my === st.tok && st.mode !== 'file') setMode('file'); return; }
      catch (e) { if (my !== st.tok) return; if (st.mode === null) setMode('tts'); }
    }
    await speakTTS(voice(raw));
  }
  function setPlayBtn() { $('ocPlay').textContent = st.playing ? '⏸ 一時停止' : '▶ 再生'; }
  async function run() {
    var my = ++st.tok; st.playing = true; setPlayBtn();
    while (st.si < S.length) {
      drawSlide(); var lines = S[st.si].lines;
      while (st.li < lines.length) {
        drawProg(); await speak(lines[st.li], my); if (my !== st.tok) return;
        await sleep(250); if (my !== st.tok) return;
        st.li++;
      }
      if (!$('ocAuto').checked || st.si >= S.length - 1 || S[st.si + 1].extra) break;
      await sleep(700); if (my !== st.tok) return;
      st.si++; st.li = 0;
    }
    st.playing = false; setPlayBtn();
    var L = S[st.si].lines.length;
    if (st.li >= L) { var nx = S[st.si + 1]; if (nx && !nx.extra) { st.si++; st.li = 0; drawSlide(); drawProg(); } else { st.li = L - 1; } }
  }
  function pause() { st.tok++; st.playing = false; stopSound(); setPlayBtn(); }
  function go(si, li) {
    var was = st.playing; st.tok++; stopSound(); st.playing = false;
    st.si = Math.max(0, Math.min(S.length - 1, si)); st.li = Math.max(0, Math.min(S[st.si].lines.length - 1, li)); drawSlide(); drawProg(); setPlayBtn(); if (was) run();
  }
  function nextL() { if (st.li < S[st.si].lines.length - 1) go(st.si, st.li + 1); else if (st.si < S.length - 1) go(st.si + 1, 0); }
  function prevL() { if (st.li > 0) go(st.si, st.li - 1); else if (st.si > 0) go(st.si - 1, S[st.si - 1].lines.length - 1); }
  function showRead(i) {
    rIdx = Math.max(0, Math.min(S.length - 1, i)); var s = S[rIdx];
    $('ocRBody').innerHTML = '<h2>' + (s.extra ? '蛇足' : '第' + (rIdx + 1) + '話') + '　' + html(s.title) + '</h2><ul>' + s.facts.map(function (f) { return '<li>' + html(f) + '</li>'; }).join('') + '</ul><p>' + s.lines.map(html).join('') + '</p>';
    $('ocRBody').style.fontSize = rSize + 'px'; $('ocRBody').scrollTop = 0; $('ocRSel').value = rIdx;
    $('ocRPrev').disabled = rIdx === 0; $('ocRNext').disabled = rIdx === S.length - 1;
  }
  function wire() {
    $('ocSlide').addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-extra]'); if (t && EX >= 0) { pause(); go(EX, 0); run(); } });
    $('ocClose').onclick = function () { pause(); $('ocStage').classList.remove('on'); };
    $('ocPlay').onclick = function () { if (st.playing) pause(); else { if (st.li >= S[st.si].lines.length) go(st.si, 0); run(); } };
    $('ocPS').onclick = function () { go(st.si - 1, 0); }; $('ocNS').onclick = function () { go(st.si + 1, 0); };
    $('ocPL').onclick = prevL; $('ocNL').onclick = nextL;
    $('ocChap').onchange = function () { go(parseInt(this.value, 10), 0); };
    $('ocRate').onchange = function () { player.playbackRate = rate(); };
    document.addEventListener('keydown', function (e) {
      if ($('ocReader').classList.contains('on')) { if (e.key === 'Escape') $('ocRClose').click(); return; }
      if (!$('ocStage').classList.contains('on')) return;
      if (e.key === ' ' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') { e.preventDefault(); $('ocPlay').click(); }
      else if (e.key === 'ArrowRight' && e.target.tagName !== 'SELECT') nextL(); else if (e.key === 'ArrowLeft' && e.target.tagName !== 'SELECT') prevL(); else if (e.key === 'Escape') $('ocClose').click();
    });
    $('ocRClose').onclick = function () { $('ocReader').classList.remove('on'); };
    $('ocReader').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('on'); });
    $('ocRSel').onchange = function () { showRead(parseInt(this.value, 10)); };
    $('ocRPrev').onclick = function () { showRead(rIdx - 1); }; $('ocRNext').onclick = function () { showRead(rIdx + 1); };
    $('ocRSm').onclick = function () { rSize = Math.max(15, rSize - 2); showRead(rIdx); }; $('ocRLg').onclick = function () { rSize = Math.min(32, rSize + 2); showRead(rIdx); };
    if (window.speechSynthesis) speechSynthesis.getVoices();
  }

  function startAudio() { load().then(function () { build(); $('ocStage').classList.add('on'); st.si = 0; st.li = 0; st.drawn = -1; drawSlide(); drawProg(); run(); }).catch(fail); }
  function startRead() { load().then(function () { build(); showRead(rIdx); $('ocReader').classList.add('on'); }).catch(fail); }
  function fail() { alert('お茶の豆知識を読み込めませんでした。通信を確認して、もう一度おためしください。'); }

  /* ホームのカード */
  function card() {
    if ($('hottoCard')) return;
    var pc = $('poemCard'); if (!pc || !pc.parentNode) return;
    var c = E('div', 'card'); c.id = 'hottoCard'; c.style.cssText = 'background:#f3f8ee;border:2px solid #c9dfb8';
    c.appendChild(E('h3', '', '🍵 ほっとひと息'));
    var p = E('p', '', ''); p.innerHTML = 'よいことも、しんぱいごとも、何かのチャンス。<br>お茶を飲んで、ひといき。リセットしませんか。'; p.style.cssText = 'line-height:1.8;font-size:1.05rem;margin:4px 0'; c.appendChild(p);
    var sub = E('p', 'muted', 'お茶の豆知識（全17話・約16分）を、音声で聞くか、文で読めます。'); sub.style.cssText = 'font-size:.9rem;margin:2px 0 6px'; c.appendChild(sub);
    var a = E('button', 'btn primary', '🎧 音声で聞く'); a.type = 'button'; a.addEventListener('click', startAudio); c.appendChild(a);
    var b = E('button', 'btn', '📖 文で読む'); b.type = 'button'; b.style.marginTop = '8px'; b.addEventListener('click', startRead); c.appendChild(b);
    var l = E('a', 'btn', '🎵 ケセラセラを聞く'); l.target = '_blank'; l.rel = 'noopener'; l.style.cssText = 'display:block;text-align:center;text-decoration:none;margin-top:8px';
    l.href = songUrl(); c.appendChild(l);
    pc.parentNode.insertBefore(c, pc.nextSibling);
    load().then(function () { l.href = songUrl(); }, function () {});
  }
  setTimeout(card, 0); setTimeout(card, 600); setTimeout(card, 2000);
  window.__ocha = { st: st, go: function () { return go.apply(null, arguments); }, run: function () { return run(); }, pause: function () { return pause(); } };
})();
