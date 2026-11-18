import {Chess} from './chess.js';
import {PUZZLES,THEMES} from './puzzles.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='chesstactics:v1';
const DEF={v:1,elo:1000,hist:[],solved:{},themes:{},days:[],daily:{},best:{blitz:0,surv:0},tot:{ok:0,n:0},set:{theme:'emerald',sound:true,vib:true,flip:false}};
const load=()=>{try{const d=JSON.parse(localStorage.getItem(KEY));return d&&d.v===1?{...structuredClone(DEF),...d,set:{...DEF.set,...d.set}}:structuredClone(DEF)}catch{return structuredClone(DEF)}};
let S=load();const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const today=()=>new Date().toLocaleDateString('sv');
const G={p:'♟︎',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
// audio
let ac;const tone=(f,d=.1,t='sine',v=.15,w=0)=>{if(!S.set.sound)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime+w;o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(g).connect(ac.destination);o.start(n);o.stop(n+d)}catch{}};
const snd={move:()=>tone(440,.08,'triangle'),cap:()=>tone(220,.12,'square',.1),check:()=>{tone(660,.1);tone(880,.12,'sine',.15,.1)},err:()=>tone(130,.25,'sawtooth',.12),win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.15,'sine',.15,i*.1))};
const vib=p=>{if(S.set.vib&&navigator.vibrate)navigator.vibrate(p)};
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.remove('hid');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hid'),2200)};
// state
let game=new Chess(),puz=null,step=0,mode='career',themeSel='all',orient='w',sel=null,targets=[],drag=null,ghost=null,busy=false,done=false,failed=false,recorded=false,hint=0,t0=0,fails=0,redo=[],last=null,hl=null,rush=null,tick=null;
const THEME_ORDER=Object.keys(THEMES);
// board
const findKing=c=>{for(const r of game.board())for(const p of r)if(p&&p.type==='k'&&p.color===c)return p.square};
function render(anim){
 const b=$('#board');b.innerHTML='';const flip=(orient==='b')!==S.set.flip,ks=game.inCheck()?findKing(game.turn()):null;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const f=flip?7-c:c,k=flip?r:7-r,sq='abcdefgh'[f]+(k+1),d=document.createElement('div');d.dataset.sq=sq;
  d.className='sq '+((f+k)%2?'l':'d')+(sel===sq?' sel':'')+(last&&(last.from===sq||last.to===sq)?' last':'')+(hl&&hl.includes(sq)?' hint':'')+(ks===sq?' chk':'');
  const p=game.get(sq);if(p){const s=document.createElement('span');s.className='pc '+(p.color==='w'?'pw':'pb');s.textContent=G[p.type];if(drag&&drag.moved&&drag.sq===sq)s.style.opacity=.25;d.append(s)}
  if(targets.includes(sq))d.classList.add(p?'cap':'dot');b.append(d)}
 if(anim&&last){const to=b.querySelector(`[data-sq=${last.to}]`),fr=b.querySelector(`[data-sq=${last.from}]`),pc=to?.querySelector('.pc');if(pc){const a=fr.getBoundingClientRect(),z=to.getBoundingClientRect();pc.style.transform=`translate(${a.left-z.left}px,${a.top-z.top}px)`;pc.getBoundingClientRect();pc.style.transition='transform .18s ease-out';pc.style.transform='none'}}
}
const canMove=c=>mode==='analysis'||(puz&&c===orient&&!busy&&!done&&!(rush&&rush.over));
const isPromo=(f,t)=>game.get(f)?.type==='p'&&(t[1]==='8'||t[1]==='1');
function doMove(f,t,pr){let m;try{m=game.move({from:f,to:t,promotion:pr})}catch{return null}last=m;sel=null;targets=[];redo=mode==='analysis'?[]:redo;
 if(game.isCheck())snd.check();else if(m.captured)snd.cap();else snd.move();vib(12);render(true);return m}
function tryMove(f,t){
 if(mode==='analysis'){if(!doMove(f,t,isPromo(f,t)?'q':undefined)){sel=null;targets=[];render()}else info(game.isCheckmate()?'Jaque mate.':'');return}
 const exp=puz.sol[step];let pr=isPromo(f,t)?'q':undefined;if(exp.slice(0,4)===f+t&&exp[4])pr=exp[4];
 const g2=new Chess(game.fen());try{g2.move({from:f,to:t,promotion:pr})}catch{sel=null;targets=[];return render()}
 if(!((f+t+(pr||''))===exp||g2.isCheckmate()))return wrong();
 doMove(f,t,pr);hl=null;step++;if(step>=puz.sol.length||game.isGameOver())return finish();
 busy=true;info('✔ ¡Correcto! Sigue…');setTimeout(()=>{const o=puz.sol[step++];doMove(o.slice(0,2),o.slice(2,4),o[4]);busy=false;if(step>=puz.sol.length)finish();else info('Tu turno.')},450);
}
function wrong(){sel=null;targets=[];render();snd.err();vib([40,40,40]);$('#board').classList.add('shake');setTimeout(()=>$('#board').classList.remove('shake'),300);
 if(!failed){failed=true;fails++;record(false)}
 if(rush){if(mode==='surv'&&--rush.lives<=0)return endRush();setStat();info('✘ Fallo. Siguiente…');busy=true;setTimeout(()=>{busy=false;nextPuzzle()},700)}else info('✘ No es esa. Inténtalo de nuevo.')}
function record(ok){if(recorded)return;recorded=true;S.tot.n++;if(ok)S.tot.ok++;const th=S.themes[puz.t]||(S.themes[puz.t]={ok:0,n:0});th.n++;if(ok)th.ok++;
 const prev=S.solved[puz.id];S.solved[puz.id]={ok:ok||!!prev?.ok};const d=today();if(!S.days.includes(d))S.days.push(d);
 if(mode==='career'){const e=1/(1+10**((puz.r-S.elo)/400)),sc=ok?(hint?.6:1):0;S.elo=Math.max(400,S.elo+Math.round(28*(sc-e)));S.hist.push({e:S.elo,t:Date.now()});S.hist=S.hist.slice(-300)}save();setStat()}
function finish(){done=true;if(!recorded)record(true);else if(mode==='career'&&failed){}snd.win();vib([20,40,20]);
 if(rush){rush.score++;if(mode==='blitz'||mode==='surv'){setStat();busy=true;setTimeout(()=>{busy=false;nextPuzzle()},500);return}}
 info(`🎉 ¡Resuelto!${failed?' (con fallos)':''} <div class="opacity-80 mt-1">${puz.why}</div>${mode==='career'?`<div class="mono text-emerald-300 mt-1">ELO ${S.elo}</div>`:''}`);
 if(mode==='daily'){const t=Math.round((Date.now()-t0)/1000);S.daily[today()]={fails,hint,t};save();$('#bShare').classList.remove('hid')}
 show({next:mode!=='daily',ana:1})}
const show=o=>{$('#bNext').classList.toggle('hid',!o.next);$('#bAna').classList.toggle('hid',!o.ana);$('#bUndo').classList.toggle('hid',!o.nav);$('#bRedo').classList.toggle('hid',!o.nav);$('#bHint').classList.toggle('hid',!!(o.nav||o.ana||o.hideHint));if(!o.ana)$('#bShare').classList.add('hid')};
const info=h=>$('#info').innerHTML=h;
function setStat(){const e=$('#stat');if(!rush){e.textContent=mode==='career'?'ELO '+S.elo:'';return}
 e.textContent=mode==='blitz'?`⏱ ${Math.floor(rush.left/60)}:${String(rush.left%60).padStart(2,'0')} · ${rush.score}`:`${'❤️'.repeat(Math.max(0,rush.lives))} · ${rush.score}`}
// puzzle flow
function pick(){let pool=PUZZLES;if(mode==='theme'&&themeSel!=='all')pool=pool.filter(p=>p.t===themeSel);
 const tg=mode==='career'?S.elo:rush?800+rush.score*50:800+Math.random()*1400;const fresh=pool.filter(p=>!S.solved[p.id]?.ok);
 const c=(fresh.length>3?fresh:pool).filter(p=>p!==puz).sort((a,b)=>Math.abs(a.r-tg)-Math.abs(b.r-tg)).slice(0,5);return c[Math.floor(Math.random()*c.length)]}
function startPuzzle(p){puz=p;game=new Chess(p.fen);orient=game.turn();step=0;sel=null;targets=[];last=null;hl=null;done=failed=recorded=busy=false;hint=0;fails=0;t0=Date.now();redo=[];
 if(mode==='analysis')mode=window._m||'career';
 $('#mlabel').textContent={career:'Carrera',daily:'Problema del día',blitz:'Blitz',surv:'Supervivencia',theme:'Tema: '+(themeSel==='all'?'todos':THEMES[themeSel])}[mode];
 $('#sub').textContent=`${THEMES[p.t]} · ${p.r} · Juegan ${orient==='w'?'blancas':'negras'}`;setStat();show({});info(`Encuentra la mejor jugada para las ${orient==='w'?'blancas':'negras'}.`);render()}
const nextPuzzle=()=>startPuzzle(pick());
function startMode(m){window._m=m;mode=m;clearInterval(tick);rush=null;
 if(m==='daily'){const n=Math.floor(Date.now()/864e5)%PUZZLES.length;startPuzzle(PUZZLES[n]);const d=S.daily[today()];if(d){done=true;info('Ya resolviste el de hoy. 🎉<div class="opacity-80 mt-1">'+puz.why+'</div>');show({ana:1});$('#bShare').classList.remove('hid')}}
 else if(m==='blitz'||m==='surv'){rush={left:180,lives:3,score:0,over:false};if(m==='blitz')tick=setInterval(()=>{if(--rush.left<=0)endRush();else setStat()},1000);nextPuzzle()}
 else nextPuzzle();view('play')}
function endRush(){clearInterval(tick);rush.over=true;const k=mode==='blitz'?'blitz':'surv';const rec=rush.score>S.best[k];if(rec)S.best[k]=rush.score;save();snd.win();busy=false;
 info(`🏁 Fin: <b>${rush.score}</b> resueltos${rec?' · ¡nuevo récord!':''}.`);show({next:1,hideHint:1});setStat();$('#bNext').onclick=()=>startMode(mode)}
$('#bNext').onclick=()=>nextPuzzle();
$('#bHint').onclick=()=>{if(!puz||done)return;hint=Math.min(2,hint+1);const e=puz.sol[step];hl=hint===1?[e.slice(0,2)]:[e.slice(0,2),e.slice(2,4)];info(hint===1?'💡 Esta es la pieza que debe moverse.':'💡 Casilla de destino marcada. Idea: '+puz.hint);render()};
$('#bAna').onclick=()=>{mode='analysis';busy=false;redo=[];sel=null;targets=[];hl=null;$('#mlabel').textContent='Análisis libre';info((puz?`<b>Idea:</b> ${puz.why}<br>`:'')+'Mueve cualquier pieza para probar variantes. Usa ◀ ▶ para navegar.');show({nav:1});$('#bShare').classList.add('hid');render()};
$('#bUndo').onclick=()=>{const m=game.undo();if(m){redo.push(m);last=game.history({verbose:true}).at(-1)||null;sel=null;targets=[];render()}};
$('#bRedo').onclick=()=>{const m=redo.pop();if(m){last=game.move(m.san);render(true)}};
$('#bFlip').onclick=()=>{S.set.flip=!S.set.flip;save();render()};
$('#bShare').onclick=async()=>{const d=S.daily[today()]||{fails,t:0,hint};const txt=`♟ ChessTactics ${today()}\n${'🟥'.repeat(d.fails)}🟩${d.hint?' 💡'+d.hint:''}\n⏱ ${d.t}s`;try{if(navigator.share)await navigator.share({text:txt});else{await navigator.clipboard.writeText(txt);toast('Copiado al portapapeles')}}catch{}};
// input
const board=$('#board');
board.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-sq]');if(!el)return;const sq=el.dataset.sq;
 if(sel&&sel!==sq&&targets.includes(sq)){tryMove(sel,sq);return}
 const p=game.get(sq);if(p&&p.color===game.turn()&&canMove(p.color)){if(ac?.state==='suspended')ac.resume();sel=sq;targets=game.moves({square:sq,verbose:true}).map(m=>m.to);drag={sq,moved:false,x:e.clientX,y:e.clientY,p};render()}else{sel=null;targets=[];render()}});
addEventListener('pointermove',e=>{if(!drag)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
 if(!drag.moved){drag.moved=true;ghost=document.createElement('span');ghost.className='ghost pc '+(drag.p.color==='w'?'pw':'pb');ghost.textContent=G[drag.p.type];document.body.append(ghost);render()}
 ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px'});
const endDrag=e=>{if(!drag)return;const d=drag;drag=null;ghost?.remove();ghost=null;if(!d.moved)return;
 const t=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-sq]')?.dataset.sq;if(t&&t!==d.sq&&targets.includes(t))tryMove(d.sq,t);else{sel=null;targets=[];render()}};
addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
// views
function view(v){$$('section').forEach(s=>s.classList.toggle('hid',s.id!=='v-'+v));$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));if(v==='stats')stats();if(v==='modes'){$('#bb').textContent=S.best.blitz;$('#bs').textContent=S.best.surv}scrollTo(0,0)}
$$('nav button').forEach(b=>b.onclick=()=>view(b.dataset.v));
$$('[data-m]').forEach(b=>b.onclick=()=>startMode(b.dataset.m));
$('#themes').innerHTML=['all',...THEME_ORDER].map(t=>`<button class="btn !py-1 text-sm" data-t="${t}">${t==='all'?'Todos':THEMES[t]}</button>`).join('');
$$('[data-t]').forEach(b=>b.onclick=()=>{themeSel=b.dataset.t;startMode('theme')});
$('#bFen').onclick=()=>{const t=$('#fen').value.trim();$('#fenErr').textContent='';let g;try{g=new Chess(t)}catch{try{g=new Chess();g.loadPgn(t)}catch{$('#fenErr').textContent='FEN/PGN no válido.';return}}
 game=g;puz=null;clearInterval(tick);rush=null;mode='analysis';orient=g.turn();last=g.history({verbose:true}).at(-1)||null;redo=[];sel=null;targets=[];hl=null;$('#mlabel').textContent='Posición importada';$('#sub').textContent='';setStat();info('Análisis libre. Mueve las piezas y usa ◀ ▶.');show({nav:1});view('play');render()};
// stats
let ch;function stats(){const days=new Set(S.days);let st=0,d=new Date();if(!days.has(d.toLocaleDateString('sv')))d.setDate(d.getDate()-1);while(days.has(d.toLocaleDateString('sv'))){st++;d.setDate(d.getDate()-1)}
 const acc=S.tot.n?Math.round(100*S.tot.ok/S.tot.n):0;
 $('#kpis').innerHTML=[['🔥 Racha',st+' d'],['🎯 Precisión',acc+'%'],['🏆 ELO',S.elo],['✅ Resueltos',S.tot.ok+'/'+S.tot.n]].map(([a,b])=>`<div class="glass p-3"><div class="text-xs opacity-60">${a}</div><div class="mono text-2xl">${b}</div></div>`).join('');
 $('#byTheme').innerHTML=THEME_ORDER.map(t=>{const x=S.themes[t]||{ok:0,n:0},p=x.n?Math.round(100*x.ok/x.n):0;return`<div><div class="flex justify-between text-xs"><span>${THEMES[t]}</span><span>${x.ok}/${x.n}</span></div><div class="h-2 rounded bg-white/10"><div class="h-2 rounded bg-emerald-400" style="width:${p}%"></div></div></div>`}).join('');
 if(window.Chart){ch?.destroy();const h=S.hist.length?S.hist.map(x=>x.e):[S.elo];ch=new Chart($('#chart'),{type:'line',data:{labels:h.map((_,i)=>i),datasets:[{data:h,borderColor:'#34d399',tension:.35,pointRadius:0}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{ticks:{color:'#9aa'}}}}})}}
// settings
function applyTheme(){document.documentElement.dataset.theme=S.set.theme==='emerald'?'':S.set.theme}
$('#bt').innerHTML=[['emerald','Esmeralda'],['wood','Madera'],['slate','Pizarra'],['neon','Neón']].map(([k,n])=>`<button class="btn" data-th="${k}">${n}</button>`).join('');
$$('[data-th]').forEach(b=>b.onclick=()=>{S.set.theme=b.dataset.th;save();applyTheme()});
$('#oSnd').checked=S.set.sound;$('#oVib').checked=S.set.vib;$('#oSnd').onchange=e=>{S.set.sound=e.target.checked;save()};$('#oVib').onchange=e=>{S.set.vib=e.target.checked;save()};
$('#bExp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'}));a.download=`chesstactics-backup-${today()}.json`;a.click();$('#bmsg').textContent='Copia exportada ✔'};
$('#fImp').onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(d.v!==1||typeof d.elo!=='number')throw 0;S={...structuredClone(DEF),...d,set:{...DEF.set,...d.set}};save();applyTheme();$('#bmsg').textContent='Copia importada ✔';setStat()}catch{$('#bmsg').textContent='Archivo no válido.'}};
$('#np').textContent=PUZZLES.length;applyTheme();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
startMode('career');
