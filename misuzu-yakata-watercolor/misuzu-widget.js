/* ケセラ トップ用「今日の童謡」ボタン
   使い方：ケセラのトップページの好きな場所に次の2行を入れます。
   <div id="misuzu-daily"></div>
   <script src="misuzu-widget.js"></script>
   （misuzu-library.json は、このファイルと同じ場所に置きます）
   金子みすゞの館で「毎日見たい」を押した人にだけ表示されます。 */
(function(){
  var KEY='kesera_misuzu_daily';
  var host=document.getElementById('misuzu-daily'); if(!host) return;
  try{ if(localStorage.getItem(KEY)!=='1') return; }catch(e){ return; }
  var base=(document.currentScript&&document.currentScript.src)||'';
  var url=base.replace(/[^\/]*$/,'')+'misuzu-library.json';
  var PINK='#d94f86';
  function el(tag,css,text){var e=document.createElement(tag); if(css)e.style.cssText=css; if(text!=null)e.textContent=text; return e;}
  function btn(text,primary){
    return el('button','font:inherit;font-size:1.1rem;padding:10px 18px;margin:4px 8px 4px 0;border-radius:999px;cursor:pointer;border:2px solid '+PINK+';'+(primary?'background:'+PINK+';color:#fff':'background:#fff;color:'+PINK),text);
  }
  function doy(){var n=new Date(),s=new Date(n.getFullYear(),0,0);return Math.floor((n-s)/86400000);}
  fetch(url).then(function(r){return r.json();}).then(function(D){
    var P=D.poems||[], T=D.tanka||[];
    var today = P.length ? P[doy()%P.length] : null;
    var more=0, state=0;
    var wrap=el('div','font-family:"BIZ UDPGothic",sans-serif;margin:12px 0');
    host.appendChild(wrap);
    function poemBox(title,text,note){
      var b=el('div','margin:10px 0;padding:14px 16px;background:#fff8fb;border:1px solid #f0d3df;border-radius:12px');
      b.appendChild(el('div','font-weight:bold;color:'+PINK+';font-size:1.15rem;margin-bottom:6px',title));
      b.appendChild(el('div','font-family:"Shippori Mincho",serif;font-size:1.2rem;line-height:2;white-space:pre-line',text));
      if(note) b.appendChild(el('div','font-size:.95rem;color:#7a5a68;margin-top:6px',note));
      return b;
    }
    function draw(){
      wrap.innerHTML='';
      if(state===0){
        var b=btn('今日の童謡 ― 金子みすゞ',true);
        b.onclick=function(){state=1;more=0;draw();};
        wrap.appendChild(b);
        var off=el('button','font:inherit;font-size:.95rem;background:none;border:none;color:#7a5a68;text-decoration:underline;cursor:pointer','表示をやめる');
        off.onclick=function(){try{localStorage.setItem(KEY,'0');}catch(e){} wrap.remove();};
        wrap.appendChild(off);
        return;
      }
      if(today){ wrap.appendChild(poemBox(today.title,today.text,'金子みすゞ『'+today.book+'』')); }
      else {
        var n=new Date(), k=(n.getMonth()===10)?(n.getDate()-1):doy(); var t=T[k%Math.max(T.length,1)]||{title:'',tanka:''};
        wrap.appendChild(poemBox(t.title+'（きょうの短歌）',t.tanka,'童謡の本文は準備中です。いまは詩を短歌にしてお届けしています。'));
      }
      if(state===2){
        for(var i=1;i<=more*3 && i<P.length;i++){
          var p=P[(doy()+i)%P.length]; wrap.appendChild(poemBox(p.title,p.text,'金子みすゞ『'+p.book+'』'));
        }
      }
      var more_b=btn('もっと読む',true), close_b=btn('しまう',false);
      var canMore = P.length>1 && (more*3 < P.length-1);
      if(canMore){ more_b.onclick=function(){state=2;more++;draw();}; wrap.appendChild(more_b); }
      close_b.onclick=function(){ if(state===2){state=1;more=0;} else {state=0;} draw(); };
      wrap.appendChild(close_b);
    }
    draw();
  }).catch(function(){});
})();
