// OPT/IN UI lab. Open index.html?ui to run.
// A panel of buttons that puts the game on any screen, banner, or message without playing to it.
// Each button calls the same function the game calls, so what you see is what a player sees.
// Runs in memory like checks.js: saved runs, the class models, and the leaderboard are never touched.
'use strict';
(function(){
  // ---- sandbox: memory storage, no network (same as checks.js) ----
  const mem=new Map();
  store.get=(k,d)=>mem.has(k)?JSON.parse(mem.get(k)):d;
  store.set=(k,v)=>{mem.set(k,JSON.stringify(v))};
  store.clear=()=>{for(const k of [...mem.keys()])if(!STORE_SHARED.has(k))mem.delete(k)};
  window.fetch=()=>Promise.reject(new Error('offline in the UI lab'));

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const perk=id=>PERKS.find(p=>p.id===id);
  const ALL2={LOC:2,HEA:2,HAB:2,PUR:2};
  const ALL_INF=INF.map(f=>f.id);
  const ME={pid:'a1b2c3d4e5f6',name:'LAB'};

  // What a class of five classmates leaves behind in each model.
  const SAMPLE={
    LOC:{hit:Array.from({length:CM_W*CM_H},(_,i)=>i===20?6:0),time:Array.from({length:CM_W*CM_H},(_,i)=>i===20?30:5)},
    HAB:{dl:.7,dr:.2,ds:.1,pick:{id:'route',w:6}},
    HEA:{t:[0,40,40,40,40,40,0,0,0,0],h:[0,2,20,2,2,2,0,0,0,0]},
    PUR:{buy:{route:3,armor:1}}
  };
  function crowdOf(runs){let c=blankCrowd();for(let i=0;i<runs;i++)c=foldCrowd(c,{accepted:true,models:SAMPLE});return c}
  const CROWD=crowdOf(5);

  // The game's own "next wave" is replaced so a screen can be dismissed without a real wave starting.
  const realStartWave=startWave;
  window.startWave=()=>toast('LAB · the next wave would start here',2400);

  // ---- scenes ----
  let boardRows=null;
  function clean(){
    clearInterval(urgencyTimer);
    hideScreens();
    ['introHold','readHold','devGate'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden')});
    closeSubModal();hideBanner();clearNote();hideKeys();
    $('logFeed').innerHTML='';$('toast').classList.remove('show');
    $('hud').classList.add('hidden');document.body.classList.remove('paused','playing');
    $('rvWhy').className='';
  }
  function seed(o){
    mem.clear();
    store.set('name',o.name==null?ME.name:o.name);store.set('pid',o.pid||ME.pid);
    store.set('seen',VERSION);store.set('skipIntro',true);
    store.set('best',o.best||{score:300,wave:2});
    if(o.packs)store.set('packs',o.packs);
    if(o.crowd)store.set('crowd',o.crowd);
    if(o.profile)store.set('profile',o.profile);
    const b=o.board||boardRows;if(b)store.set('board',b);
  }
  // A frozen run: the arena is drawn behind whatever the button shows.
  function run(o){
    o=o||{};
    clean();seed(o);
    S=newState();enterRun();
    S.mode='play';S.paused=true;
    S.wave=o.wave==null?3:o.wave;S.coins=o.coins==null?80:o.coins;S.score=o.score==null?1250:o.score;
    S.queue=[];S.spawns=[];S.enemies=[];S.revealQ=[];
    Object.assign(S.shared,o.shared||{});
    for(const k of o.inf||[])S.inf[k]=true;
    if(o.hp!=null)S.p.hp=o.hp;
    if(o.fair){S.fair=true;S.member=true}
    return S;
  }
  function title(o){
    clean();seed(o||{});S=null;leaveToTitle(false);
  }
  function shop(o,ids){
    run(o);o=o||{};
    S.offer=(ids||['route','armor','heavy']).map(perk);S.taken=[];
    S.amend=o.amend||null;S.hotI=o.hot==null?-1:o.hot;S.hotBadge='POPULAR';
    if(o.picks)Object.assign(S.tele.picks,o.picks);
    presentTerms();
    if(o.fine)$('fineBox').open=true;
  }
  function pauseMenu(o){run(o);S.paused=false;setPause(true)}

  // Plays a headless run with scripted movement, so the dossier is built from real telemetry.
  function simulate(strategy,waves){
    const saved={...sfx};for(const k in sfx)sfx[k]=()=>{};
    window.startWave=realStartWave;
    S.paused=false;S.mode='play';
    try{
      S.wave=0;realStartWave();
      const path=[['a','w'],['d','w'],['d','s'],['a','s']];
      for(let steps=0;S.wave<=waves&&S.mode!=='dossier'&&steps<60*60*8;steps++){
        if(S.mode==='terms'){
          S.offer.forEach((pk,i)=>{
            if(S.taken.includes(i))return;
            choose(i,strategy==='share'&&pk.data?'free':'pay');
          });
          closeTerms();continue;
        }
        if(S.mode==='reveal'){nextReveal();continue}
        if(S.mode==='safety'){declineSafetyAsk();continue}
        for(const k of ['a','d','w','s'])keys[k]=false;
        for(const k of path[Math.floor(steps/90)%4])keys[k]=true;
        if(steps%60===0)for(const e of S.enemies)if(!e.dead&&!e.partner&&!e.safety)damageEnemy(e,9999,e.x,e.y);
        if(S.mode==='play'&&S.p.hp<=1)S.p.hp=2;
        update(1/60);
      }
    }finally{
      for(const k of ['a','d','w','s'])keys[k]=false;
      Object.assign(sfx,saved);window.startWave=()=>toast('LAB · the next wave would start here',2400);
      S.paused=true;
    }
  }
  function played(o,strategy,waves,tweak){
    run(Object.assign({wave:0,coins:30},o));
    simulate(strategy,waves||5);
    S.p.hp=0;
    if(tweak)tweak();
    showDossier();
    $('toast').classList.remove('show');$('logFeed').innerHTML='';
  }
  // Six players with different habits, so the leaderboard has real-looking rows.
  async function buildBoard(){
    toast('LAB · building a sample leaderboard…',3000);
    const cast=[['NOVA','share',7],['PIXEL','private',5],['RIVER','share',4],['JUNE','private',8],['ASH','share',3],[ME.name,'share',6]];
    let acc=[];
    for(let i=0;i<cast.length;i++){
      const [name,strategy,waves]=cast[i],pid=name===ME.name?ME.pid:('0'+i+'cafe0'+i+'beef').slice(0,12);
      run({wave:0,coins:30,board:acc,name,pid,profile:strategy==='share'?{shared:i%2?{LOC:2,HAB:1}:ALL2,inf:[]}:undefined});
      simulate(strategy,waves);S.p.hp=0;showDossier();
      await sleep(150);
      acc=store.get('board',[])||[];
    }
    // Offline, the game's own retries add each row up to three times. Wait them out and keep one of each.
    await sleep(1700);
    const seen=new Set();
    boardRows=(store.get('board',[])||[]).filter(e=>{const k=e.pid+'|'+e.at;if(seen.has(k))return false;seen.add(k);return true});
  }
  async function openBoardScene(){
    if(!boardRows)await buildBoard();
    clean();seed({});S=null;openBoard('title');
  }

  // Wave banner as the game builds it, with the news line for the situation.
  function news(w,setup){run({wave:w});if(setup)setup();const n=waveNews(w);banner('WAVE '+w,n.text,n.col,2.4)}
  // The evidence line a pattern shows, built from a window of play that fits it.
  function evidence(b){
    const win={q:[0,0,0,0],hits:0,panic:0,still:0,moving:0,camp:0,edge:0,open:0};
    const fit={zone:{q:[200,40,30,30]},panic:{hits:10,panic:8},still:{still:100,moving:80},edge:{edge:120,open:60}}[b.id];
    try{const r=fit&&b.test(Object.assign(win,fit),false);if(typeof r==='string')return r}catch(e){}
    return b.id==='loyal'?'You picked THRUST first in 4 of your last 5 runs.':'Pattern observed.';
  }

  // Reveal mockups: one short line for the risk and one for the upside, instead of the full paragraphs.
  // The game is not changed; these rewrite the reveal screen after the game draws it.
  const SHORT={
    retreat:['Where you go when you\'re hurt can reveal a condition you never shared.','A watch can send help to exactly where you are.'],
    home:['Where your orders go and where you spend time point to your home.','Packages, and help, can find your door.'],
    needs:['What you buy can reveal what you need before you say it.','A pharmacy can remind you to refill before you run out.'],
    impulse:['Timers are built for the moments you buy without thinking.','Loyalty rewards the things you really do buy again.'],
    predict:['Where you go and when you go shows where you\'re going next.','Your phone can warn you about traffic before you leave.'],
    risk:['Health and habits can be used to change what you pay.','Careful drivers can pay less, and a health problem can be caught early.'],
    zone:['Apps can learn where you spend time without ever asking.','A city can add service where people really go.'],
    panic:['How you react under stress is easy to predict.','Cars brake for a panicked swerve, and banks pause a rushed payment.'],
    still:['The less you change, the cheaper you are to predict.','Your phone can preload your usual route.'],
    loyal:['Your past sessions were saved and compared.','Your usual order comes back in one tap.'],
    edge:['Stores log where you pause, then put ads there.','Stores fix crowded aisles with the same data.']
  };
  function revealMock(f,beh,tap){
    run({shared:ALL2,inf:beh?[]:[f.id]});
    if(beh)S.model.on[f.id]=true;
    S.revealQ=[beh?{...f,kind:'beh',ev:evidence(f)}:f];nextReveal();
    const [why,good]=SHORT[f.id],w=$('rvWhy');
    const pair=`<div class="rl bad"><i>⚠</i><span>${esc(why)}</span></div><div class="rl ok"><i>✓</i><span>${esc(good)}</span></div>`;
    w.classList.add('mock');$('rvGood').textContent='';
    if(!tap){w.innerHTML=pair;return}
    w.innerHTML=`<button type="button" class="rlTog">IN REAL LIFE ▾</button><div class="rlBody" hidden>${pair}</div>`;
    w.querySelector('.rlTog').onclick=e=>{e.stopPropagation();const b=w.querySelector('.rlBody');b.hidden=!b.hidden};
  }

  // ---- catalog ----
  const groups=[];let cur;
  const group=name=>{cur={name,items:[]};groups.push(cur)};
  const item=(label,fn,see)=>cur.items.push({label,fn,see,group:cur.name});

  group('Wave banners');
  item('Wave · plain',()=>{run();banner('WAVE '+S.wave,'','#38e1ff',1.5)},'#banner.show');
  item('Wave · Fair Play (green)',()=>{run({fair:true});banner('WAVE '+S.wave,'','#7dff6a',1.5)},'#banner.show');
  item('Wave 1 · data on file',()=>news(1,()=>{S.shared.LOC=1}),'#banner.show');
  item('Wave 1 · inferences on file',()=>news(1,()=>{S.inf.risk=true}),'#banner.show');
  item('Wave 1 · behavior patterns on file',()=>news(1,()=>{S.model.carried=['zone']}),'#banner.show');
  item('Wave 1 · member file',()=>news(1,()=>{S.member=true}),'#banner.show');
  item('Wave 5 · a broker is coming',()=>news(5),'#banner.show');
  item('Wave 6 · leaked data has buyers',()=>news(6,()=>{S.breachWave=6}),'#banner.show');
  for(let t=1;t<=4;t++)item('Wave 4 · field news '+t,()=>news(4,()=>{S.formJustUp=true;S.formTier=t}),'#banner.show');
  for(let r=1;r<=3;r++)item('Wave 4 · groups news '+r,()=>news(4,()=>{S.formSkillUp=r}),'#banner.show');
  item('WAVE CLEAR',()=>{run();banner('WAVE CLEAR','','#7dff6a',1.6)},'#banner.show');
  item('DATA BREACH (real wave-clear path)',()=>{
    run({shared:ALL2,wave:4});S.mode='clear';S.breachWave=-1;
    const r=Math.random;Math.random=()=>0;
    try{afterClear()}finally{Math.random=r}
    if(S.mode!=='breach')throw new Error('the breach did not fire');
  },'#banner.show');
  item('YOU OPTED IN (intro hold)',()=>{clean();seed({});openOptIn()},'#introHold');

  group('Halo and rescue');
  item('Halo ask · mid-run',()=>{run();S.haloNow=false;openSafetyAsk(false)},'#safetyAsk:not(.hidden)');
  item('Halo ask · a hit would end the run',()=>{run({hp:1});S.haloNow=true;openSafetyAsk(false)},'#safetyAsk:not(.hidden)');
  item('HALO On banner',()=>{run();S.haloNow=false;openSafetyAsk(false);acceptSafetyAsk()},'#banner.show');
  item('HALO Off banner',()=>{run();S.haloNow=false;openSafetyAsk(false);declineSafetyAsk()},'#banner.show');
  item('HALO SAVED YOU',()=>{run({hp:1});haloRescue()},'#banner.show');
  item('MAYDAY SENT',()=>{run({hp:1});sendMayday()},'#banner.show');
  item('MAYDAY SENT · RETREAT MAPPED (3s wait)',()=>{run({hp:1,inf:['retreat']});sendMayday()},'#banner.show');
  item('RESCUED',()=>{run({hp:1});rescueArrives()},'#banner.show');
  item('HALO broker line (both sold)',()=>{run();S.safetyFile={hea:true,loc:true};banner('HALO',haloBrokerLine(),'#c04bff',2.4)},'#banner.show');
  item('HALO broker line (location only)',()=>{run();S.safetyFile={hea:false,loc:true};banner('HALO',haloBrokerLine(),'#c04bff',2.4)},'#banner.show');

  group('Reveals');
  for(const f of INF)item('Inference · '+f.name,()=>{run({shared:ALL2,inf:[f.id]});S.revealQ=[f];nextReveal()},'#reveal:not(.hidden)');
  for(const b of BEH)item('Pattern · '+b.name,()=>{run({shared:{LOC:1}});S.model.on[b.id]=true;S.revealQ=[{...b,kind:'beh',ev:evidence(b)}];nextReveal()},'#reveal:not(.hidden)');
  item('All reveals in a row',()=>{
    run({shared:ALL2,inf:ALL_INF});
    S.revealQ=INF.map(f=>f).concat(BEH.map(b=>({...b,kind:'beh',ev:evidence(b)})));nextReveal();
  },'#reveal:not(.hidden)');

  group('Reveal mockups');
  for(const f of INF)item('Icons · '+f.name,()=>revealMock(f,false,false),'#reveal:not(.hidden)');
  for(const b of BEH)item('Icons · '+b.name,()=>revealMock(b,true,false),'#reveal:not(.hidden)');
  item('Tap to open · '+INF[0].name,()=>revealMock(INF[0],false,true),'#reveal:not(.hidden) .rlTog');
  item('Tap to open · '+BEH[0].name,()=>revealMock(BEH[0],true,true),'#reveal:not(.hidden) .rlTog');

  group('Shop');
  item('Shop · nothing on file (no-file markup)',()=>shop({wave:1}),'#terms:not(.hidden)');
  item('Shop · all four types on file',()=>shop({profile:{shared:ALL2,inf:[]}}),'#terms:not(.hidden)');
  item('Shop · "popular" badge',()=>shop({hot:1}),'#terms:not(.hidden)');
  item('Shop · extra data on the card (bundle)',()=>shop({amend:{i:0,kind:'bundle',extra:'HAB'}}),'#terms:not(.hidden)');
  item('Shop · may be resold',()=>shop({amend:{i:0,kind:'resell'}}),'#terms:not(.hidden)');
  item('Shop · processed on-device',()=>shop({amend:{i:0,kind:'local'}}),'#terms:not(.hidden)');
  item('Shop · upgrade already maxed',()=>shop({picks:{route:3}}),'#terms:not(.hidden)');
  item('Shop · Fair Play member',()=>shop({fair:true}),'#terms:not(.hidden)');
  item('Shop · class bestseller, deal, and packs',()=>shop({crowd:CROWD,packs:['PUR','HAB'],coins:120}),'#terms:not(.hidden)');
  item('Shop · hurt (NEEDS PREDICTED)',()=>shop({shared:ALL2,inf:['needs'],hp:2},['armor','sos','heavy']),'#terms:not(.hidden)');
  item('Shop · rush timer (IMPULSE PROFILED)',()=>shop({shared:ALL2,inf:['impulse']}),'#terms:not(.hidden)');
  item('Shop · risk score (careful)',()=>shop({shared:ALL2,inf:['risk']}),'#terms:not(.hidden)');
  item('Shop · fine print open',()=>shop({fine:true}),'#terms:not(.hidden)');
  item('Fair Play pitch',()=>{shop({});openSubModal()},'#tosPitch:not(.hidden)');

  group('Screens');
  item('Title · first visit',()=>title({name:'',best:{score:0,wave:0}}),'#title:not(.hidden)');
  item('Title · returning with a saved run',()=>{run({shared:{LOC:1}});S.checkpoint='live';saveGame();leaveToTitle(false)},'#title:not(.hidden)');
  item('Title · packs and member file',()=>title({packs:['LOC','PUR'],profile:{shared:ALL2,inf:ALL_INF,member:true}}),'#title:not(.hidden)');
  item('Name prompt',()=>{clean();seed({});openName()},'#name:not(.hidden)');
  item('Name prompt · error',()=>{clean();seed({});openName();$('nameIn').value='';submitName()},'#name:not(.hidden)');
  item('Changelog',()=>{clean();seed({});openLog()},'#log:not(.hidden)');
  item('Settings',()=>{clean();seed({});S=null;openSettings()},'#settings:not(.hidden)');
  item('Key hints',()=>{run({wave:1});showKeys()},'#keys:not(.hidden)');
  item('Pause menu · empty file',()=>pauseMenu({}),'#pause:not(.hidden)');
  item('Pause menu · full file',()=>{
    pauseMenu({shared:ALL2,inf:ALL_INF,crowd:CROWD,packs:['LOC','HAB','HEA','PUR']});
  },'#pause:not(.hidden)');
  item('Leaderboard',openBoardScene,'#board:not(.hidden)');
  item('Leaderboard · empty',()=>{clean();seed({board:[]});boardRows=boardRows;store.set('board',[]);S=null;openBoard('title')},'#board:not(.hidden)');
  item('Teacher passcode',()=>{clean();seed({});openDevGate()},'#devGate:not(.hidden)');

  group('Dossier');
  item('Dossier · shared everything (new best)',()=>played({profile:{shared:ALL2,inf:ALL_INF}},'share',6),'#dossier:not(.hidden)');
  item('Dossier · paid, shared nothing',()=>played({best:{score:999999,wave:30}},'private',5),'#dossier:not(.hidden)');
  item('Dossier · Halo rescue (sold health and location)',()=>played({profile:{shared:ALL2,inf:[]}},'share',5,()=>{
    S.tele.emerg=1;S.safetyFile={hea:true,loc:true};
  }),'#dossier:not(.hidden)');
  item('Dossier · mayday (nothing sold)',()=>played({},'private',5,()=>{S.tele.emergDirect=1}),'#dossier:not(.hidden)');
  item('Dossier · mayday failed',()=>played({},'private',5,()=>{S.tele.emergDirect=1;S.tele.distressFail=1}),'#dossier:not(.hidden)');
  item('Dossier · class models used on you',()=>played({crowd:CROWD,packs:['PUR','HAB','LOC','HEA']},'private',5,()=>{
    Object.assign(S.tele,{lingerSpawns:5,classShots:8,pressT:12,dangerShield:1,bestSeats:2,dealSaved:14});
  }),'#dossier:not(.hidden)');
  item('Dossier · Fair Play member',()=>played({fair:true},'private',5),'#dossier:not(.hidden)');
  item('Dossier · second view (already on the board)',()=>played({},'private',4,()=>{S.filed=true}),'#dossier:not(.hidden)');

  group('Dialogs');
  item('Confirm · Delete My Data',()=>{clean();seed({});S=null;leaveToTitle(false);deleteMyData()},'#confirm:not(.hidden)');
  item('Confirm · Abandon this run',()=>{run();abandonRun()},'#confirm:not(.hidden)');

  group('Toasts and nags');
  item('Toast · sound muted',()=>{run();if(muted)toggleMute();toggleMute()},'#toast.show');
  item('Toast · sound on',()=>{run();if(!muted)toggleMute();toggleMute()},'#toast.show');
  item('Toast · subscribed to Fair Play',()=>{shop({coins:80});confirmFair()},'#toast.show');
  item('Toast · cannot afford Fair Play',()=>{shop({coins:0});confirmFair()},'#toast.show');
  item('Toast · Fair Play ended',()=>{shop({fair:true});endFair()},'#toast.show');
  item('Toast · Fair Play ran out of credits',()=>{shop({fair:true});endFair('Not enough credits. Fair Play ended. The member file stays on. Ads can still find it.')},'#toast.show');
  item('Toast · bought a class pack',()=>{shop({crowd:CROWD,coins:120});buyPack('PUR')},'#toast.show');
  item('Toast · data deleted',()=>{run();commitDelete()},'#toast.show');
  item('Toast · heart-rate nag (Health shared)',()=>{
    run({shared:{HEA:1},hp:3});S.nagT=0;S.p.inv=0;hurtPlayer();
  },'#toast.show');
  item('Toast · pattern outdated',()=>{run();toast('MODEL OUTDATED: '+BEH[0].name+'. You changed.',3500)},'#toast.show');

  group('Ads');
  const adsOf=(label,shared,inf)=>item('Ads · '+label,()=>{
    run({shared,inf});for(let i=0;i<4;i++)spawnAd();
    if(!S.ads.length)throw new Error('no ads appeared');
  });
  for(const t of TYPES)adsOf(DATA[t].n,{[t]:1});
  adsOf('Location + Purchases (pair ads)',{LOC:1,PUR:1});
  adsOf('Health + Habits (pair ads)',{HEA:1,HAB:1});
  adsOf('everything shared, all inferences',ALL2,ALL_INF);

  // ---- panel ----
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  const box=document.createElement('div');box.id='uiLab';
  box.innerHTML=`<style>
#uiLab{position:fixed;top:8px;right:8px;width:272px;max-height:calc(100vh - 16px);overflow:auto;z-index:99999;background:#0b0c18f2;border:1px solid #2a3060;border-radius:6px;color:#d5dcf5;font:12px/1.35 'JetBrains Mono',ui-monospace,monospace;box-shadow:0 8px 30px #000a}
#uiLab .hd{display:flex;gap:6px;align-items:center;padding:8px;position:sticky;top:0;background:#0b0c18;border-bottom:1px solid #1d2140}
#uiLab .hd b{flex:1;letter-spacing:.12em;color:#fff}
#uiLab button{font:inherit;cursor:pointer;color:#d5dcf5;background:#12152b;border:1px solid #232850;border-radius:3px;padding:4px 8px}
#uiLab button:hover{background:#1b2040;border-color:#38e1ff}
#uiLab .it{display:block;width:100%;text-align:left;margin:2px 0;padding:5px 8px;border-left:3px solid #232850}
#uiLab .it.cur{background:#1d2250;border-left-color:#38e1ff}
#uiLab .it.good{border-left-color:#7dff6a}
#uiLab .it.bad{border-color:#ff6b6b;color:#ff9a9a;border-left-color:#ff6b6b}
#uiLab input{width:calc(100% - 16px);margin:6px 8px 2px;padding:5px 8px;background:#12152b;color:#d5dcf5;border:1px solid #232850;border-radius:3px;font:inherit}
#uiLab .sum{margin:4px 8px;color:#8a9bff;min-height:1em}
#uiLab details{padding:0 8px 4px}
#uiLab summary{cursor:pointer;letter-spacing:.1em;color:#8a9bff;padding:6px 0;text-transform:uppercase;font-size:11px}
#uiLab.min{width:auto}#uiLab.min .body{display:none}
#uiLab:not(:hover){opacity:.55}
#rvWhy.mock,#reveal #rvWhy.mock{font-family:inherit;font-size:16px;line-height:1.4;color:#ffd7de;margin-top:26px;max-width:600px;display:flex;flex-direction:column;gap:12px;text-align:left}
#reveal #rvWhy.mock .rl{display:flex;gap:12px;align-items:center}
#reveal #rvWhy.mock .rl i{font-style:normal;flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:700}
#reveal #rvWhy.mock .bad i{background:#ff6b6b2e;color:#ff6b6b;border:1px solid #ff6b6b88}
#reveal #rvWhy.mock .ok i{background:#7dff6a22;color:#7dff6a;border:1px solid #7dff6a77}
#reveal #rvWhy.mock .ok{color:#c3ecc8}
#reveal.beh #rvWhy.mock{color:#eadcff}#reveal.beh #rvWhy.mock .ok{color:#c3ecc8}
#reveal #rvWhy.mock .rlTog{align-self:center;background:none;border:1px solid #6b3a47;border-radius:3px;color:#cfa0ad;padding:7px 14px;letter-spacing:.18em;font:inherit;font-size:12px;cursor:pointer}
#reveal #rvWhy.mock .rlBody{display:flex;flex-direction:column;gap:12px}#reveal #rvWhy.mock .rlBody[hidden]{display:none}
#uiLab label{display:flex;gap:6px;align-items:center;margin:4px 8px;color:#8a9bff;cursor:pointer}
</style>
<div class="hd"><b>UI LAB</b><button id="labAll" title="Trigger every item and report any that fail">run all</button><button id="labMin" title="Hide or show the list (key: \`)">–</button></div>
<div class="body"><input id="labFind" placeholder="filter…" autocomplete="off"><label><input type="checkbox" id="labHold" style="width:auto;margin:0"> keep banners up</label><div class="sum" id="labSum">${groups.reduce((n,g)=>n+g.items.length,0)} items · click one</div>
${groups.map(g=>`<details open data-g="${esc(g.name)}"><summary>${esc(g.name)}</summary>${g.items.map((it,i)=>`<button type="button" class="it" data-g="${esc(g.name)}" data-i="${i}">${esc(it.label)}</button>`).join('')}</details>`).join('')}</div>`;
  document.body.appendChild(box);

  const btn=(g,i)=>box.querySelector(`.it[data-g="${CSS.escape(g)}"][data-i="${i}"]`);
  const find=(g,i)=>groups.find(x=>x.name===g).items[i];
  function visible(sel){const e=document.querySelector(sel);return !!e&&!e.classList.contains('hidden')}
  async function fire(it){
    await it.fn();
    if(S&&S.mode==='play'&&!S.sandbox)S.paused=true;
    const b=$('banner');if($('labHold').checked&&b.classList.contains('show'))b.classList.add('hold');
  }
  // Keep game keys, and a focused button, from reacting to panel clicks.
  box.addEventListener('mousedown',e=>{if(e.target.tagName==='BUTTON')e.preventDefault()});
  ['keydown','keyup','keypress'].forEach(t=>$('labFind').addEventListener(t,e=>e.stopPropagation()));
  box.addEventListener('click',async e=>{
    const b=e.target.closest('.it');if(!b)return;
    box.querySelectorAll('.it.cur').forEach(x=>x.classList.remove('cur'));b.classList.add('cur');
    try{await fire(find(b.dataset.g,+b.dataset.i));$('labSum').textContent=''}
    catch(err){b.classList.add('bad');$('labSum').textContent='FAILED · '+(err&&err.message||err);console.error(err)}
  });
  $('labMin').onclick=()=>box.classList.toggle('min');
  addEventListener('keydown',e=>{if(e.key==='`'&&document.activeElement!==$('labFind'))box.classList.toggle('min')});
  $('labFind').addEventListener('input',()=>{
    const q=$('labFind').value.trim().toLowerCase();
    box.querySelectorAll('.it').forEach(b=>{b.style.display=!q||b.textContent.toLowerCase().includes(q)?'':'none'});
    box.querySelectorAll('details').forEach(d=>{d.style.display=[...d.querySelectorAll('.it')].some(b=>b.style.display!=='none')?'':'none'});
  });

  // Runs every item once and reports the ones that threw, logged an error, or left nothing on screen.
  async function smoke(){
    const errs=[],onErr=ev=>errs.push(ev.message||String(ev.error));
    addEventListener('error',onErr);
    const ce=console.error;console.error=(...a)=>{errs.push(a.join(' '));ce.apply(console,a)};
    const bad=[];let n=0;
    box.querySelectorAll('.it').forEach(b=>b.classList.remove('good','bad'));
    for(const g of groups)for(let i=0;i<g.items.length;i++){
      const it=g.items[i];errs.length=0;let why='';
      $('labSum').textContent='checking '+(++n)+' · '+it.label;
      try{
        await fire(it);await sleep(90);
        if(it.see&&!visible(it.see))why='nothing on screen for '+it.see;
      }catch(err){why=err&&err.message||String(err)}
      if(!why&&errs.length)why=errs[0];
      btn(g.name,i).classList.add(why?'bad':'good');
      if(why)bad.push(it.label+' → '+why);
    }
    console.error=ce;removeEventListener('error',onErr);
    window.uiLab.failed=bad;
    $('labSum').textContent=bad.length?bad.length+' of '+n+' failed · see console':'all '+n+' items work';
    if(bad.length)console.warn('UI lab failures:\n'+bad.join('\n'));
    title({name:'',best:{score:0,wave:0}});
    return bad;
  }
  $('labAll').onclick=smoke;
  // From the console: uiLab.go('HALO SAVED YOU') triggers an item by its label.
  async function go(label){
    const it=groups.flatMap(g=>g.items).find(x=>x.label===label);
    if(!it)throw new Error('no item called '+label);
    await fire(it);
  }
  window.uiLab={groups,run,smoke,go,failed:[]};
  document.title='OPT/IN UI lab';
  title({name:'',best:{score:0,wave:0}});
})();
