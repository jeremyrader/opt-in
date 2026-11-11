// OPT/IN check page. Open index.html?check to run.
// Each check sets up a situation directly, runs one rule, and compares the result
// to what the card, reveal, or fine print promises. See TESTING.md.
// Checks run in memory: browser storage and the leaderboard are never touched.
'use strict';
(function(){
  // ---- sandbox: memory storage, no network, repeatable randomness ----
  const mem=new Map();
  store.get=(k,d)=>mem.has(k)?JSON.parse(mem.get(k)):d;
  store.set=(k,v)=>{mem.set(k,JSON.stringify(v))};
  store.clear=()=>{for(const k of [...mem.keys()])if(!STORE_SHARED.has(k))mem.delete(k)};
  window.fetch=()=>Promise.reject(new Error('offline during checks'));
  let seed=12345;
  Math.random=()=>{seed=(seed+0x6D2B79F5)|0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
  const errors=[];
  const oldErr=console.error;console.error=(...a)=>{errors.push(a.join(' '));oldErr.apply(console,a)};

  // ---- harness ----
  const results=[];let area='';
  function group(name){area=name}
  function check(name,fn,star){
    let r;
    try{r=fn();results.push({area,name,star,ok:true,note:r&&r.note||''})}
    catch(e){results.push({area,name,star,ok:false,note:e&&e.message||String(e)})}
  }
  const star=(name,fn)=>check(name,fn,true);
  function eq(a,b,what){if(a!==b)throw new Error((what?what+': ':'')+'expected '+JSON.stringify(b)+', got '+JSON.stringify(a))}
  function ok(c,what){if(!c)throw new Error(what)}
  function between(v,lo,hi,what){if(!(v>=lo&&v<=hi))throw new Error((what?what+': ':'')+'expected '+lo+'–'+hi+', got '+v)}
  const perk=id=>PERKS.find(p=>p.id===id);

  // A fresh run with nothing on file, no class data, at wave 3, in the shop.
  function fresh(o){
    o=o||{};
    mem.clear();
    if(o.crowd)store.set('crowd',o.crowd);
    if(o.packs)store.set('packs',o.packs);
    beginRun();
    S.queue=[];S.spawns=[];S.enemies=[];S.ebullets=[];
    S.wave=o.wave||3;S.coins=o.coins==null?999:o.coins;
    if(o.shared){S.shared=Object.assign({},o.shared);unlockInfs()}
    for(const k of o.inf||[])S.inf[k]=true;
    if(o.hp!=null)S.p.hp=o.hp;
    S.revealQ=[];
    return S;
  }
  // Three runs' worth of shares for every type, so each pair is ready.
  const ALL2={LOC:2,HEA:2,HAB:2,PUR:2};
  function shopWith(ids){S.mode='terms';S.offer=ids.map(perk);S.taken=[]}
  function seededCrowd(runs,models){let c=blankCrowd();for(let i=0;i<runs;i++)c=foldCrowd(c,{accepted:true,models});return c}
  const CLASS_SAMPLE={
    LOC:{hit:Array.from({length:CM_W*CM_H},(_,i)=>i===20?6:0),time:Array.from({length:CM_W*CM_H},(_,i)=>i===20?30:5)},
    HAB:{dl:.7,dr:.2,ds:.1,pick:{id:'route',w:6}},
    HEA:{t:[0,40,40,40,40,40,0,0,0,0],h:[0,2,20,2,2,2,0,0,0,0]},
    PUR:{buy:{route:3,armor:1}}
  };

  // =====================================================================
  group('Price modifiers');
  star('Base price is the list price, whether or not anything is on file',()=>{
    fresh({shared:{LOC:1}});const p=perk('heavy');eq(price(p),listPrice(p),'with a file');
    fresh();eq(price(p),listPrice(p),'with nothing on file')});
  star('RISK SCORE: careful play is 20% off',()=>{
    fresh({shared:{LOC:1},inf:['risk']});S.tele.hits=0;const p=perk('heavy');eq(price(p),Math.round(listPrice(p)*.8))});
  star('RISK SCORE: risky play costs 50% more',()=>{
    fresh({shared:{LOC:1},inf:['risk']});S.tele.hits=99;const p=perk('heavy');eq(price(p),Math.round(listPrice(p)*1.5))});
  star('NEXT MOVE PREDICTED: your usual first pick costs 2×',()=>{
    fresh({shared:{LOC:1}});S.model.on.loyal=true;S.model.fav='heavy';const p=perk('heavy');eq(price(p),listPrice(p)*2)});
  star('NEEDS PREDICTED: PLATING and RESERVE cost 50% more at 2♥',()=>{
    fresh({shared:{LOC:1},inf:['needs'],hp:2});
    eq(price(perk('armor')),Math.round(listPrice(perk('armor'))*1.5),'PLATING');
    eq(price(perk('sos')),Math.round(listPrice(perk('sos'))*1.5),'RESERVE');
    eq(price(perk('heavy')),listPrice(perk('heavy')),'PAYLOAD is not marked up')});
  star('NEEDS PREDICTED: no markup at 3♥',()=>{
    fresh({shared:{LOC:1},inf:['needs'],hp:3});eq(price(perk('armor')),listPrice(perk('armor')))});
  star('IMPULSE PROFILED: 25% more while the timer runs',()=>{
    fresh({shared:{LOC:1},inf:['impulse']});shopWith(['heavy','armor','route']);S.rushUntil=performance.now()+5000;
    eq(price(perk('heavy')),Math.round(listPrice(perk('heavy'))*1.25))});
  star('IMPULSE PROFILED: normal price after the timer ends',()=>{
    fresh({shared:{LOC:1},inf:['impulse']});shopWith(['heavy','armor','route']);S.rushUntil=performance.now()-1;
    eq(price(perk('heavy')),listPrice(perk('heavy')))});
  star('IMPULSE PROFILED: no rush price once the timer is turned off',()=>{
    fresh({shared:{LOC:1},inf:['impulse']});shopWith(['heavy','armor','route']);S.rushUntil=performance.now()+5000;S.tele.urgencyOff=true;
    eq(price(perk('heavy')),listPrice(perk('heavy')))});
  star('Fair Play: 20% off',()=>{
    fresh({shared:{LOC:1}});S.fair=true;const p=perk('heavy');eq(price(p),Math.round(listPrice(p)*.8))});
  star('Class deal: 30% off the least-bought offered upgrade',()=>{
    fresh({shared:{LOC:1},crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR}),packs:['PUR']});
    shopWith(['route','armor','heavy']);eq(dealId(),'heavy','deal goes to');
    eq(price(perk('heavy')),Math.round(listPrice(perk('heavy'))*.7));
    eq(price(perk('route')),listPrice(perk('route')),'bestseller is full price')});
  star('Worst case: every markup at once still gives a whole, finite price',()=>{
    fresh({shared:{LOC:1},inf:['risk','needs','impulse'],hp:2,wave:10});
    S.tele.hits=99;S.model.on.loyal=true;S.model.fav='armor';shopWith(['armor','heavy','route']);S.rushUntil=performance.now()+5000;
    const p=perk('armor'),pr=price(p),x=pr/listPrice(p);
    ok(Number.isInteger(pr)&&pr>0,'price '+pr);
    return {note:'PLATING at wave 10 costs '+pr+' (×'+x.toFixed(2)+' list). Decide if that is too high.'}});
  check('No price ever drops below 1',()=>{
    fresh({shared:{LOC:1},inf:['risk'],wave:1});S.fair=true;S.tele.hits=0;for(const p of PERKS)ok(price(p)>=1,p.name+' costs '+price(p))});

  // =====================================================================
  group('Inferences');
  for(const f of INF){
    check(f.name+' unlocks from '+f.need.map(t=>DATA[t].n).join(' + ')+' with one shared twice',()=>{
      fresh({shared:{[f.need[0]]:2,[f.need[1]]:1}});ok(S.inf[f.id],'did not unlock')});
    check(f.name+' does not unlock from one share each',()=>{
      fresh({shared:{[f.need[0]]:1,[f.need[1]]:1}});ok(!S.inf[f.id],'unlocked too early')});
  }
  check('Every pair of data types has exactly one inference',()=>{
    for(let i=0;i<TYPES.length;i++)for(let j=i+1;j<TYPES.length;j++){
      const n=INF.filter(f=>f.need.includes(TYPES[i])&&f.need.includes(TYPES[j])).length;
      eq(n,1,TYPES[i]+'+'+TYPES[j])}});
  check('ROUTE PREDICTED: 50% more warning before ships arrive',()=>{
    fresh({shared:{LOC:1},inf:['predict']});S.p.x=W/2;S.p.y=H/2;spawnWarn('ping');eq(+S.spawns[0].max.toFixed(3),+(.85*1.5).toFixed(3))});
  star('RETREAT MAPPED: at 2♥, about half of new ships spawn near your hurt spot',()=>{
    fresh({shared:{LOC:1},inf:['retreat'],hp:2});S.retreat.fill(0);S.retreat[classCell(100,100)]=10;
    const spot=retreatSpot();S.p.x=W-100;S.p.y=H-100;for(let i=0;i<200;i++)spawnWarn('ping');
    const sent=S.tele.retreatSpawns||0,near=S.spawns.filter(s=>Math.hypot(s.x-spot.x,s.y-spot.y)<160).length,want=retreatChance()*200;
    between(sent,want-30,want+30,'retreat spawns (of 200)');ok(near>=sent,'only '+near+' of '+sent+' retreat spawns landed near the spot')});
  star('RETREAT MAPPED: no retreat spawns at 3♥',()=>{
    fresh({shared:{LOC:1},inf:['retreat'],hp:3});S.retreat.fill(0);S.retreat[classCell(100,100)]=10;
    S.p.x=W-100;S.p.y=H-100;for(let i=0;i<100;i++)spawnWarn('ping');eq(S.tele.retreatSpawns||0,0)});
  star('RETREAT MAPPED: ships never spawn on top of you, even on your spot',()=>{
    fresh({shared:{LOC:1},inf:['retreat'],hp:2});S.retreat.fill(0);S.retreat[classCell(100,100)]=10;
    const spot=retreatSpot();S.p.x=spot.x;S.p.y=spot.y;for(let i=0;i<100;i++)spawnWarn('ping');
    eq(S.spawns.filter(s=>Math.hypot(s.x-S.p.x,s.y-S.p.y)<100).length,0,'ships within 100px')});
  star('RETREAT MAPPED: still works when HOME INFERRED is on too',()=>{
    fresh({shared:{LOC:1},inf:['retreat','home'],hp:2});S.retreat.fill(0);S.retreat[classCell(100,100)]=10;
    S.p.x=W-100;S.p.y=H-100;for(let i=0;i<200;i++)spawnWarn('ping');const want=retreatChance()*200;between(S.tele.retreatSpawns||0,want-30,want+30,'retreat spawns (of 200)')});
  star('RETREAT MAPPED: a mayday brings help 2 seconds sooner',()=>{
    fresh();eq(helpWait(),HELP_WAIT,'without');S.inf.retreat=true;eq(helpWait(),HELP_WAIT-2,'with')});
  star('HOME INFERRED: ships spawn close to you',()=>{
    fresh({shared:{LOC:1},inf:['home'],hp:5});S.p.x=W/2;S.p.y=H/2;for(let i=0;i<50;i++)spawnWarn('ping');
    eq(S.spawns.filter(s=>Math.hypot(s.x-S.p.x,s.y-S.p.y)>190).length,0,'ships farther than 190px')});
  star('HOME INFERRED: every 3rd wave starts with a shield',()=>{
    fresh({shared:{LOC:1},inf:['home'],wave:2});S.p.shield=0;startWave();eq(S.wave,3);eq(S.p.shield,1,'shield on wave 3');
    S.p.shield=0;startWave();eq(S.p.shield,0,'no shield on wave 4')});
  star('NEEDS PREDICTED: at 2♥ the shop always stocks PLATING or RESERVE',()=>{
    fresh({shared:{LOC:1},inf:['needs'],hp:2});let miss=0;
    for(let i=0;i<50;i++){if(!seatOffer().some(p=>p.id==='armor'||p.id==='sos'))miss++}eq(miss,0,'shops without a repair')});
  star('IMPULSE PROFILED: the offer timer starts at 5 seconds',()=>{
    fresh({shared:{LOC:1},inf:['impulse']});shopWith(['heavy','armor','route']);startUrgency();clearInterval(urgencyTimer);
    ok($('urgency').textContent.endsWith('0:05'),'timer says '+$('urgency').textContent)});
  star('IMPULSE PROFILED: buying an upgrade again returns 70%',()=>{
    fresh({shared:{LOC:1},inf:['impulse']});S.tele.picks.heavy=1;shopWith(['heavy','armor','route']);S.rushUntil=0;
    const pr=price(perk('heavy')),c0=S.coins;choose(0,'pay');eq(c0-S.coins,pr-Math.max(5,Math.round(pr*.7)))});
  const maxAll=()=>{for(const p of PERKS)S.tele.picks[p.id]=p.cap};
  star('A maxed upgrade is never offered again',()=>{
    fresh({wave:30});S.tele.picks.heavy=perk('heavy').cap;for(let i=0;i<100;i++)ok(!seatOffer().some(p=>p.id==='heavy'),'PAYLOAD offered while maxed')});
  star('Upgrades run out: one REPAIR while hurt, nothing at full health',()=>{
    fresh({wave:30,hp:2});maxAll();let o=seatOffer();eq(o.map(p=>p.id).join(),'fix','hurt');
    fresh({wave:30});maxAll();eq(seatOffer().length,0,'full health')});
  star('REPAIR heals 1♥ for credits, with no loyalty bonus and no data',()=>{
    fresh({wave:10,hp:2});maxAll();S.offer=seatOffer();S.taken=[];S.mode='terms';S.tele.picks.fix=3;
    const pr=price(REPAIR),c0=S.coins;choose(0,'pay');eq(S.p.hp,3,'hearts');eq(c0-S.coins,pr,'credits');eq(TYPES.filter(t=>S.shared[t]).length,0,'types shared')});
  check('NEEDS PREDICTED: REPAIR costs 50% more at 2♥',()=>{
    fresh({shared:{LOC:1},inf:['needs'],hp:2});eq(price(REPAIR),Math.round(listPrice(REPAIR)*1.5))});
  check('Without IMPULSE PROFILED, buying again returns 40%',()=>{
    fresh({shared:{LOC:1}});S.tele.picks.heavy=1;shopWith(['heavy','armor','route']);
    const pr=price(perk('heavy')),c0=S.coins;choose(0,'pay');eq(c0-S.coins,pr-Math.max(5,Math.round(pr*.4)))});

  // =====================================================================
  group('Data types');
  check('There are 4 data types: Location, Health, Habits, Purchases',()=>{eq(TYPES.join(),'LOC,HEA,HAB,PUR')});
  for(const t of TYPES){
    check(DATA[t].n+': its upgrade is free with Accept and shares the type',()=>{
      const p=PERKS.find(q=>q.data===t);ok(p,'no upgrade uses it');fresh({shared:{LOC:1}});shopWith([p.id,'armor','heavy']);
      const c0=S.coins,before=S.shared[t]||0;choose(0,'free');eq(S.coins,c0,'credits spent');eq(S.shared[t],before+1,'times shared')});
    check(DATA[t].n+': its ads run once shared',()=>{
      fresh({shared:{[t]:1}});const pool=buildAds();ok(ADS[t].some(a=>pool.includes(a)),'none of its ads are in the pool')});
  }
  check('Paying for a data upgrade shares nothing',()=>{
    fresh({shared:{LOC:1}});shopWith(['rewards','armor','heavy']);choose(0,'pay');ok(!S.shared.PUR,'Purchases was shared')});
  check('REWARDS: about 25% more credits from ships',()=>{
    fresh();S.p.rewards=1;const before=S.coinsArr.length;
    for(let i=0;i<400;i++)killEnemy({x:400,y:300,coins:2,type:'ping',r:10,hp:1,pts:10});
    between(S.coinsArr.length-before,950,1050,'coins from 400 ships worth 2')});
  check('Pair ads run when both types are shared',()=>{
    fresh({shared:{LOC:1,PUR:1}});const pool=buildAds();ok(ADSX['LOC+PUR'].some(a=>pool.includes(a)),'missing')});

  // =====================================================================
  group('Your file');
  const near=()=>S.spawns.filter(s=>Math.hypot(s.x-S.p.x,s.y-S.p.y)<220).length;
  const grow=(...t)=>{for(const k of t)S.shared[k]=1};  // more types on file without unlocking inferences
  star('Every run starts with '+START_COINS+' credits',()=>{mem.clear();beginRun();eq(S.coins,START_COINS)});
  star('File weight counts data types plus inferences',()=>{
    fresh();eq(fileWeight(),0,'nothing on file');eq(harmScale(),1,'scale with nothing on file');
    fresh({shared:ALL2});eq(fileWeight(),TYPES.length+INF.length,'everything on file');eq(+harmScale().toFixed(2),+(1+HARM.per*(FILE_MAX-1)).toFixed(2),'full scale')});
  star('LOCATION: some ships spawn close to you, more on a bigger file',()=>{
    fresh();S.p.x=W/2;S.p.y=H/2;for(let i=0;i<300;i++)spawnWarn('ping');eq(near(),0,'close spawns with nothing shared');
    fresh({shared:{LOC:1}});S.p.x=W/2;S.p.y=H/2;for(let i=0;i<300;i++)spawnWarn('ping');const small=near();between(small,45,105,'close spawns (of 300), Location only');
    fresh({shared:{LOC:1}});grow('HEA','HAB','PUR');S.p.x=W/2;S.p.y=H/2;for(let i=0;i<300;i++)spawnWarn('ping');ok(near()>small+15,'4 types: '+near()+' close spawns, 1 type: '+small);
    eq(S.spawns.filter(s=>Math.hypot(s.x-S.p.x,s.y-S.p.y)<130).length,0,'ships within 130px')});
  star('HEALTH: ships fire faster when you are hurt, from 3♥ on a big file',()=>{
    fresh({shared:{HEA:1}});eq(weakHp(),2,'small file');eq(+weakFire().toFixed(2),1.55,'small file fire');
    grow('LOC','HAB','PUR');eq(weakHp(),3,'4 types');ok(weakFire()>1.55,'fire does not grow')});
  star('HABITS: patterns take longer to lose on a bigger file',()=>{
    fresh({shared:{HAB:1}});eq(patternKeep(),0,'1 type');eq(patternExtra(),0,'1 type');
    fresh({shared:ALL2});ok(patternKeep()>=3,'full file keeps '+patternKeep());eq(patternExtra(),1,'full file');
    fresh({shared:{LOC:2,HEA:2,PUR:2}});eq(patternKeep(),0,'Habits not shared')});
  star('PURCHASES: some ordinary ships read your upgrades',()=>{
    const count=()=>{let n=0;for(let i=0;i<400;i++)if(shipAdapt({type:'ping',skill:'raw'}))n++;return n};
    fresh();eq(count(),0,'with Purchases not shared');
    fresh({shared:{PUR:1}});between(count(),25,75,'of 400 ships, Purchases only');
    for(let i=0;i<50;i++)eq(shipAdapt({type:'broker',skill:'raw'}),false,'a broker')});
  star('ROUTE PREDICTED: some ships fly toward where you will be',()=>{
    fresh({shared:{LOC:1},inf:['predict']});let n=0;for(let i=0;i<400;i++)if(routeLead({})>0)n++;between(n,90,190,'of 400 ships');
    fresh({shared:{LOC:1}});eq(routeLead({}),0,'without the inference')});
  star('RISK SCORE: high-risk, Halo brings you back with 1♥ less',()=>{
    fresh({hp:1,shared:{LOC:1},inf:['risk']});S.tele.hits=99;S.mode='play';S.safetyAsked=true;S.safetyOn=true;S.p.inv=0;hurtPlayer();eq(S.p.hp,2,'hearts')});
  star('RISK SCORE: high-risk, a mayday takes 2 seconds longer',()=>{
    fresh({shared:{LOC:1},inf:['risk']});S.tele.hits=99;eq(helpWait(),HELP_WAIT+2,'high-risk');S.tele.hits=0;eq(helpWait(),HELP_WAIT,'careful')});
  star('NEEDS PREDICTED: hurt, PLATING heals 1♥ less',()=>{
    fresh({shared:{LOC:1},inf:['needs'],hp:2});const m=S.p.maxHp;perk('armor').apply(S.p);eq(S.p.hp,2,'PLATING heal');eq(S.p.maxHp,m+1,'PLATING max');
    fresh({shared:{LOC:1},inf:['needs'],hp:4});perk('armor').apply(S.p);eq(S.p.hp,5,'PLATING heal at 4♥')});

  // =====================================================================
  group('Halo and mayday');
  star('Halo on: back instantly with 3♥, and health and location are shared',()=>{
    fresh({hp:1});S.mode='play';S.safetyAsked=true;S.safetyOn=true;S.p.inv=0;hurtPlayer();
    eq(S.p.hp,3,'hearts');eq(S.shared.HEA,1,'health');eq(S.shared.LOC,1,'location')});
  star('Halo off: a mayday waits, and nothing is shared',()=>{
    fresh({hp:1});S.mode='play';S.safetyAsked=true;S.safetyOn=false;S.p.inv=0;hurtPlayer();
    eq(S.distressT,HELP_WAIT,'wait');ok(!S.shared.HEA&&!S.shared.LOC,'data was shared')});
  star('Mayday: a hit during the wait ends the run',()=>{
    fresh({hp:1});S.mode='play';S.safetyAsked=true;S.safetyOn=false;S.p.inv=0;hurtPlayer();S.p.inv=0;S.sosT=0;hurtPlayer();eq(S.mode,'dead')});
  check('Mayday: rescue returns you with 2♥',()=>{
    fresh({hp:1});S.mode='play';S.safetyAsked=true;S.safetyOn=false;S.p.inv=0;hurtPlayer();rescueArrives();eq(S.p.hp,2)});
  check('The first fatal hit asks about Halo',()=>{
    fresh({hp:1});S.mode='play';S.p.inv=0;hurtPlayer();eq(S.mode,'safety')});

  // =====================================================================
  group('Class models and packs');
  for(const t of CLASS_TYPES){
    star(DATA[t].n+' model: full strength at 5 shared runs',()=>{
      const c=seededCrowd(5,{[t]:CLASS_SAMPLE[t]});fresh({crowd:c});eq(S.cm[t].s,1)});
    check(DATA[t].n+' model: 2 runs is 40% strength',()=>{
      const c=seededCrowd(2,{[t]:CLASS_SAMPLE[t]});fresh({crowd:c});eq(S.cm[t].s,.4)});
    star(DATA[t].n+' model: a run adds only the types it shared',()=>{
      fresh({shared:{[t]:1}});S.tele.heat=new Float32Array(10).fill(500);S.tele.picks={route:1};
      const s=classSample(S.tele);ok(s&&s[t],'missing '+t);eq(Object.keys(s).join(),t)});
  }
  star('Class harms reach a player who never shared',()=>{
    fresh({crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR,LOC:CLASS_SAMPLE.LOC})});
    ok(!TYPES.some(t=>S.shared[t]),'player has shares');ok(cmOn('PUR')&&cmOn('LOC'),'models are off');
    let seats=0;for(let i=0;i<40;i++){S.tele.picks={};if(seatOffer().some(p=>p.id==='route'))seats++}eq(seats,40,'shops with the bestseller')});
  check('Sandbox runs do not use class models',()=>{
    fresh({crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR})});S.sandbox=true;ok(!cmOn('PUR'),'model is on in the sandbox')});
  star('Dev-only runs do not change the class Accept count',()=>{
    const c=foldCrowd(blankCrowd(),{devOnly:true,accepted:true,models:{PUR:CLASS_SAMPLE.PUR}});eq(c.n,0);eq(c.models.PUR.k,1,'model still learns')});
  check('Older runs fade as new ones arrive',()=>{
    let c=foldCrowd(blankCrowd(),{accepted:true,models:{PUR:{buy:{route:1}}}});c=foldCrowd(c,{accepted:true,models:{PUR:{buy:{armor:1}}}});
    ok(c.models.PUR.buy.route<c.models.PUR.buy.armor,'route '+c.models.PUR.buy.route+' vs armor '+c.models.PUR.buy.armor)});
  check('A pack costs 40 and stays bought',()=>{
    fresh({crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR}),coins:100});S.mode='terms';buyPack('PUR');eq(S.coins,60);ok(hasPack('PUR'),'not owned');
    eq((store.get('packs',[])||[]).join(),'PUR','saved packs')});
  check('A pack cannot be bought without 40 credits',()=>{
    fresh({crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR}),coins:39});S.mode='terms';buyPack('PUR');ok(!hasPack('PUR'),'bought anyway')});

  // =====================================================================
  group('Delete My Data');
  star('Delete clears your file, packs, retreat record, and board rows, and keeps the class',()=>{
    fresh({shared:ALL2,crowd:seededCrowd(5,{PUR:CLASS_SAMPLE.PUR})});
    store.set('pid','me');store.set('packs',['PUR']);store.set('retreat',[1,2,3]);saveProfile();saveModel();
    store.set('board',[{pid:'me',score:5},{pid:'other',score:9}]);
    commitDelete();
    eq(store.get('profile',null),null,'profile');eq(store.get('packs',null),null,'packs');eq(store.get('retreat',null),null,'retreat');
    eq(store.get('model',null),null,'behavior patterns');
    eq((store.get('board',[])||[]).map(e=>e.pid).join(),'other','board rows');
    eq(getCrowd().models.PUR.k,5,'class model kept')});

  // =====================================================================
  group('Saves');
  star('A saved run comes back with the same wave, credits, and file',()=>{
    fresh({shared:{LOC:2,PUR:1}});S.wave=4;S.coins=37;S.checkpoint='live';saveGame();
    const r=restoreRun(store.get('run',null));eq(r.wave,4,'wave');eq(r.coins,37,'credits');eq(r.shared.LOC,2,'Location');eq(r.shared.PUR,1,'Purchases')});
  star('Old saves drop Face Scan, Contacts, and Messages',()=>{
    fresh({shared:{LOC:1}});S.checkpoint='live';saveGame();
    const run=store.get('run',null);run.shared={LOC:1,CON:2,MSG:1,BIO:1};run.inf={face:true,graph:true,mood:true,predict:true};
    const r=restoreRun(run);eq(Object.keys(r.shared).join(),'LOC');eq(Object.keys(r.inf).join(),'predict')});
  check('Old profiles drop removed types and inferences',()=>{
    mem.clear();store.set('profile',{shared:{LOC:1,CON:2},inf:['graph','risk']});const p=loadProfile();
    eq(Object.keys(p.shared).join(),'LOC');eq(Object.keys(p.inf).join(),'risk')});
  star('Dying with no network does not throw',()=>{
    fresh({shared:{LOC:1}});S.mode='play';die();eq(S.mode,'dead')});

  // =====================================================================
  group('Dossier');
  check('Counts say "of 4 data types"',()=>{
    fresh({shared:{LOC:1}});S.mode='play';die();showDossier();ok($('dossier').innerText.includes('of 4 data types'),'missing')});

  // =====================================================================
  group('Text');
  check('No leftover Face Scan, Contacts, or Messages wording',()=>{
    const text=JSON.stringify([DATA,PERKS.map(p=>[p.name,p.desc,p.again]),INF,BEH.map(b=>[b.name,b.desc,b.why,b.good]),ADS,ADSX,fineText()]);
    const hits=(text.match(/face scan|\bcontacts\b|\bmessages\b|group chat/gi)||[]);eq(hits.length,0,'found '+[...new Set(hits)].join(', '))});
  check('Every inference has a reason and an upside',()=>{for(const f of INF)ok(f.why&&f.good,f.name)});

  // =====================================================================
  group('Decisions page');
  check('Every hand-written decision matches the game text and code it describes',()=>{
    const a=decisionsAudit();
    eq(a.stale.length,0,'out of date: '+a.stale.map(x=>x.title+' ('+x.keys.join(', ')+')').join('; ')+'. Review decisions.js, then run decisionsStamp()')});
  check('Every class model, pack, and inference has its wording on the decisions page',()=>{
    const a=decisionsAudit();eq(a.missing.length,0,'missing: '+a.missing.join(', '))});

  // =====================================================================
  group('Full run');
  star('A run with everything shared reaches wave 10 with no errors',()=>{
    fresh({shared:ALL2,wave:0});S.p.maxHp=999;S.p.hp=999;S.wave=0;startWave();
    const n0=errors.length;let steps=0;
    while(S.wave<10&&steps<60*60*15){
      steps++;
      if(S.mode==='terms'){closeTerms();continue}
      if(S.mode==='reveal'){nextReveal();continue}
      if(S.mode==='safety'){declineSafetyAsk();continue}
      if(steps%120===0)for(const e of S.enemies)if(!e.dead&&!e.partner&&!e.safety)damageEnemy(e,9999,e.x,e.y);
      S.p.hp=Math.max(S.p.hp,500);
      update(1/60);
    }
    eq(errors.length-n0,0,'console errors');ok(S.wave>=10,'stopped at wave '+S.wave+' in mode '+S.mode);
    return {note:'Reached wave '+S.wave+' in '+Math.round(steps/60)+' game seconds.'}});

  // ---- report ----
  S=null;
  ['hud','terms','reveal','pause','dossier','safetyAsk'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden')});
  render();

  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function render(){
    const fail=results.filter(r=>!r.ok),pass=results.length-fail.length;
    const areas=[...new Set(results.map(r=>r.area))];
    const box=document.createElement('div');box.id='checkPage';
    box.innerHTML=`<style>
#checkPage{position:fixed;inset:0;z-index:9999;overflow:auto;background:#0b0c18;color:#d5dcf5;font:14px/1.45 'JetBrains Mono',ui-monospace,monospace;padding:24px 16px}
#checkPage .wrap{max-width:860px;margin:0 auto}
#checkPage h1{font:700 22px/1.2 system-ui,sans-serif;margin:0 0 4px;color:#fff}
#checkPage .sum{margin:0 0 18px;color:${fail.length?'#ff6b6b':'#7dff6a'}}
#checkPage h2{font-size:12px;letter-spacing:.12em;color:#8a9bff;margin:20px 0 6px;text-transform:uppercase}
#checkPage .row{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid #1d2140}
#checkPage .st{font-weight:700}#checkPage .ok{color:#7dff6a}#checkPage .no{color:#ff6b6b}
#checkPage .note{color:#ffd23b;font-size:12px}#checkPage .err{color:#ff9a9a;font-size:12px}
#checkPage a{color:#38e1ff}
</style><div class="wrap"><h1>OPT/IN checks</h1>
<p class="sum">${pass} passed · ${fail.length} failed · ★ high risk · <a href="">run again</a></p>
${areas.map(a=>`<h2>${esc(a)}</h2>`+results.filter(r=>r.area===a).map(r=>`<div class="row"><span class="st ${r.ok?'ok':'no'}">${r.ok?'PASS':'FAIL'}</span><span>${r.star?'★ ':''}${esc(r.name)}${r.note?`<div class="${r.ok?'note':'err'}">${esc(r.note)}</div>`:''}</span></div>`).join('')).join('')}
</div>`;
    document.body.appendChild(box);
    document.title=(fail.length?'✗ ':'✓ ')+'OPT/IN checks';
  }
})();
