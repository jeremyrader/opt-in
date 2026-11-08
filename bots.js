// OPT/IN bot lab. Open index.html?bots to run.
// Bots play real runs at high speed with no drawing: they aim, dodge, dash, and shop by a fixed policy.
// An experiment plays the same seeds once per option ("arm"), so the only difference between arms is the choice.
// Runs in memory like checks.js: saved runs, the class models, and the leaderboard are never touched. See TESTING.md.
'use strict';
(function(){
  // ---- sandbox: memory storage, no network ----
  const mem=new Map();
  store.get=(k,d)=>mem.has(k)?JSON.parse(mem.get(k)):d;
  store.set=(k,v)=>{mem.set(k,JSON.stringify(v))};
  store.clear=()=>{for(const k of [...mem.keys()])if(!STORE_SHARED.has(k))mem.delete(k)};
  window.fetch=()=>Promise.reject(new Error('offline in the bot lab'));

  const realRandom=Math.random,realNow=performance.now.bind(performance);
  function rng(seed){return ()=>{seed=(seed+0x6D2B79F5)|0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
  const perk=id=>PERKS.find(p=>p.id===id);
  const DT=1/60,ARENA={w:1280,h:760};

  // How well a bot plays. "see" is the share of enemy shots it notices, "look" how far ahead it plans (seconds),
  // "react" the frames between decisions, and "aimErr" how far off its aim drifts.
  const SKILL={
    novice: {see:.6, look:.3, margin:4, dash:false,react:6,aimErr:.18,wifi:.5},
    average:{see:.85,look:.45,margin:10,dash:true, react:3,aimErr:.07,wifi:1},
    expert: {see:.98,look:.6, margin:16,dash:true, react:2,aimErr:.02,wifi:1}
  };
  // What a class of five classmates leaves behind in each model (same as checks.js).
  const CLASS_SAMPLE={
    LOC:{hit:Array.from({length:CM_W*CM_H},(_,i)=>i===20?6:0),time:Array.from({length:CM_W*CM_H},(_,i)=>i===20?30:5)},
    HAB:{dl:.7,dr:.2,ds:.1,pick:{id:'route',w:6}},
    HEA:{t:[0,40,40,40,40,40,0,0,0,0],h:[0,2,20,2,2,2,0,0,0,0]},
    PUR:{buy:{route:3,armor:1}}
  };
  function seededCrowd(runs){let c=blankCrowd();for(let i=0;i<runs;i++)c=foldCrowd(c,{accepted:true,models:CLASS_SAMPLE});return c}

  // ---- the bot ----
  // Aims at the nearest ship with lead. To move, it tries each of 8 directions and standing still, plays the next
  // fraction of a second forward for each, and takes the one that stays clearest of shots and ships it has noticed.
  // If every path is hit soon and the dash is ready, it dashes (a dash can't be hit).
  const DIRS=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[.707,-.707],[-.707,.707],[-.707,-.707]];
  const DKEY=[[],['d'],['a'],['s'],['w'],['d','s'],['d','w'],['a','s'],['a','w']];
  function drive(bot){
    const p=S.p,sk=bot.skill;
    let tgt=null,bd=1e9;
    for(const e of S.enemies){if(!combatTarget(e))continue;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<bd){bd=d;tgt=e}}
    if(tgt){
      const t=bd/740,j=sk.aimErr*bd;
      // With LEAD the player hovers the ship itself: shots bend toward a hovered ship, so the bot keeps the cursor on it.
      const lead=p.homing>0?.35:1;
      let mx=tgt.x+(tgt.vx||0)*t*lead+(bot.rng()-.5)*j,my=tgt.y+(tgt.vy||0)*t*lead+(bot.rng()-.5)*j;
      if(p.homing>0){const hx=mx-tgt.x,hy=my-tgt.y,hd=Math.hypot(hx,hy),lim=tgt.r+10;if(hd>lim){mx=tgt.x+hx/hd*lim;my=tgt.y+hy/hd*lim}}
      mouse.x=mx;mouse.y=my;
    }
    else{mouse.x=W/2;mouse.y=H/2-100}
    if(bot.step%sk.react)return;
    const shots=[];
    for(const b of S.ebullets){
      let seen=bot.seen.get(b);if(seen==null){seen=bot.rng()<sk.see;bot.seen.set(b,seen)}
      if(seen&&Math.hypot(b.x-p.x,b.y-p.y)<700*sk.look+120)shots.push(b);
    }
    const ships=S.enemies.filter(e=>!e.dead&&!e.partner&&!e.safety&&Math.hypot(e.x-p.x,e.y-p.y)<420);
    const spd=p.speed*(S.distressT>0?.4:1),steps=Math.max(3,Math.round(sk.look/.05));
    // THRUST's slide bends movement across the aim line. Plan with the same bend the game applies.
    const slide=p.slide||1,ca=Math.cos(p.ang),sa=Math.sin(p.ang);
    // The hotspot pays credits for standing still inside it, and gives a shield and faster fire. Players drift toward it when it is calm.
    const wW=bot.arm.hotspot===false?0:sk.wifi||0,wx=S.wifi?S.wifi.x*W:0,wy=S.wifi?S.wifi.y*H:0,inside=Math.hypot(p.x-wx,p.y-wy)<WIFI_R-15;
    const costs=[];
    let best=0,bestCost=1e9,bestHit=1e9;
    for(let i=0;i<DIRS.length;i++){
      let [dx,dy]=DIRS[i];let cost=0,hitT=1e9;
      if(slide>1&&(dx||dy)){const al=dx*ca+dy*sa,ac=-dx*sa+dy*ca;dx=ca*al-sa*ac*slide;dy=sa*al+ca*ac*slide}
      for(let k=1;k<=steps;k++){
        const t=k*.05,x=clamp(p.x+dx*spd*t,p.r,W-p.r),y=clamp(p.y+dy*spd*t,p.r,H-p.r),near=1/(t+.1);
        for(const b of shots){
          const gap=Math.hypot(b.x+b.vx*t-x,b.y+b.vy*t-y)-p.r-(b.r||5);
          if(gap<0&&t<hitT)hitT=t;
          if(gap<sk.margin)cost+=(sk.margin-gap)/sk.margin*near*3;
        }
        for(const e of ships){
          const room=e.type==='crawler'?110:55,gap=Math.hypot(e.x+(e.vx||0)*t-x,e.y+(e.vy||0)*t-y)-p.r-e.r;
          if(gap<0&&t<hitT)hitT=t;
          if(gap<room)cost+=(room-gap)/room*near;
        }
        if(k===steps&&p.blank>0&&tgt&&tgt.type!=='crawler'){cost+=Math.abs(Math.hypot(tgt.x-x,tgt.y-y)-110)/220*.9}
        if(k===steps&&wW){cost+=wW*Math.min(Math.hypot(x-wx,y-wy),500)/500*1.2;if(i===0&&inside)cost-=wW*.5}
        if(k===steps){const edge=Math.min(x,y,W-x,H-y);if(edge<120)cost+=(120-edge)/120*1.5;cost+=Math.hypot(x-W/2,y-H/2)/Math.hypot(W/2,H/2)*.4}
      }
      if(i===bot.last)cost*=.9;
      costs.push(cost);
      if(cost<bestCost){bestCost=cost;best=i;bestHit=hitT}
    }
    // A dash can't be hit. Dash when a hit is about to land, or, with BURNERS (a short recharge), when the best path is still crowded.
    const burners=p.dashCD<1.05;
    const wantDash=sk.dash&&p.dashT<=0&&(bestHit<.2||(burners&&bestCost>1.6));
    if(wantDash&&best===0){let b2=1;for(let i=2;i<DIRS.length;i++)if(costs[i]<costs[b2])b2=i;best=b2}
    bot.last=best;
    for(const k of ['a','d','w','s'])keys[k]=false;
    for(const k of DKEY[best])keys[k]=true;
    if(wantDash)dashReq=true;
  }

  // ---- shopping ----
  // cards: {id:'free'|'pay'|'skip'} for the cards under test. others: what to do with every other card.
  //   buy   = pay for anything affordable, never share
  //   share = Accept every data card, pay for the rest if affordable
  //   skip  = take nothing else
  function shop(bot){
    const A=bot.arm;
    if(A.read)vclock+=A.read*1000;
    if(A.fair&&!S.fair&&S.coins>=subPrice()){const c=S.coins;confirmFair();bot.r.fairPaid+=c-S.coins}
    for(const id of A.force){
      const pk=perk(id);
      if(!pk||S.offer.some(o=>o.id===id)||perkMaxed(pk)||!perkOpen(pk))continue;
      const seat=S.offer.findIndex(o=>!A.force.includes(o.id));if(seat<0)continue;
      if(S.amend&&S.amend.i===seat)S.amend=null;
      if(S.hotI===seat)S.hotI=-1;
      S.offer[seat]=pk;bot.r.forced++;
    }
    const order=S.offer.map((pk,i)=>i).sort((i,j)=>(A.cards[S.offer[j].id]?1:0)-(A.cards[S.offer[i].id]?1:0));
    for(const i of order){
      if(S.mode!=='terms')break;
      const pk=S.offer[i];
      const shareIt=A.others==='share'&&pk.data&&(!A.shareOnly||A.shareOnly.includes(pk.data));
      let a=A.cards[pk.id]||(A.others==='skip'?'skip':shareIt?'free':'pay');
      if(a==='free'&&(!pk.data||S.fair))a='pay';
      if(a==='skip')continue;
      if(a==='pay'&&S.coins<price(pk)){if(A.cards[pk.id])bot.r.cantAfford++;continue}
      const pr=price(pk);choose(i,a);
      if(a==='pay')bot.r.spent+=pr;
      if(A.cards[pk.id])bot.r.got++;
    }
    if(S.mode==='terms')closeTerms();
  }

  // ---- breach what-ifs (test-only) ----
  // A copy of the game's afterClear() with breach settings that can be changed per arm. The game itself is not touched.
  // Game values: dataW 1 (each share counts 1), wifiW 1 (hotspot exposure counts fully), min 3, per .07, cap .45, cool 3,
  // typeBoost 0, and the only cost is one broker ship in the next wave.
  // Costs scale with how many data types leaked: credits (share of credits lost per type), hearts (per 2 types, never below 1♥),
  // shield (a breach strips the shield).
  function breachAfterClear(B){
    return function(){
      if(S.mode!=='clear')return;
      breedStrain();
      if(S.sandbox){S.mode='play';return}
      learnPatterns();
      const types=TYPES.filter(t=>S.shared[t]).length;
      const exp=shareExp()*(B.dataW==null?1:B.dataW)+(S.expWifi||0)*(B.wifiW==null?1:B.wifiW);
      const chance=Math.min(B.cap==null?.45:B.cap,(exp-2)*(B.per==null?.07:B.per)+(B.typeBoost||0)*Math.max(0,types-2));
      if(exp>=(B.min==null?3:B.min)&&(S.breachWave<0||S.wave-S.breachWave>=(B.cool==null?3:B.cool))&&Math.random()<chance){
        S.breachNext=true;S.tele.breaches++;
        if(B.credits&&types){const lost=Math.round(S.coins*Math.min(1,B.credits*types));S.coins-=lost;S.tele.breachLost=(S.tele.breachLost||0)+lost}
        if(B.hearts&&types){const h=Math.ceil(types/2)*B.hearts;S.p.hp=Math.max(1,S.p.hp-h);S.tele.breachHp=(S.tele.breachHp||0)+h}
        if(B.shield&&types)S.p.shield=0;
        S.breachLine='';S.mode='breach';S.breachT=2.4;S.checkpoint='breach';saveGame();
      }else if(openTerms()){S.checkpoint='terms';saveGame()}
    };
  }

  // ---- file harms ----
  // The game's harms grow with file weight (types shared + inferences); their knobs live in the game's HARM object.
  // arm.harm = knobs to try for this run (e.g. {per:.3}); arm.noHarm turns the scaled harms off. Both are restored after.
  function harmOn(arm){
    const saved=Object.assign({},HARM);
    if(arm.harm&&arm.harm!==true)Object.assign(HARM,arm.harm);
    if(arm.noHarm)HARM.on=false;
    return ()=>{for(const k in HARM)delete HARM[k];Object.assign(HARM,saved)};
  }
  function patchFn(name,pairs){
    let s=window[name].toString();
    for(const [a,b] of pairs){if(!s.includes(a))throw new Error('patch: '+name+' no longer contains '+a);s=s.replace(a,b)}
    return (0,eval)('('+s+')');
  }

  // ---- Habits score split (test-only) ----
  // Habits on file keeps its longer streak window (3.4 s instead of 2.2 s): the streak counter, the music and the nags
  // stay as they are. Points use a separate count that, for everyone, resets after 2.2 s without a kill or on a hit.
  // Sharing Habits then feels like a bigger streak but pays the same points as not sharing.
  let splitKill=null;
  function splitOn(){
    if(!splitKill)splitKill=patchFn('killEnemy',[['const mult=1+Math.min(S.combo,50)*.1','const mult=1+Math.min(__split(),50)*.1']]);
    const saved=window.killEnemy;window.killEnemy=splitKill;
    window.__split=()=>{const t=S.t,h=S.tele.hits;if(S._ph!==h||t-(S._pt==null?-99:S._pt)>2.2)S._pc=0;S._pc++;S._pt=t;S._ph=h;return S._pc};
    return ()=>{window.killEnemy=saved;delete window.__split};
  }

  // ---- one run ----
  let vclock=0;
  function playRun(arm,seed,maxWave){
    mem.clear();
    store.set('pid','b0b0b0'+String(seed).padStart(6,'0'));store.set('name','BOT');store.set('skipIntro',true);store.set('seen',VERSION);
    if(arm.crowd)store.set('crowd',seededCrowd(arm.crowd));
    if(arm.packs)store.set('packs',arm.packs);
    if(arm.start)store.set('profile',{shared:arm.start,inf:[]});
    const savedSfx={...sfx},sW=W,sH=H,savedUnlock=window.unlockInfs;
    if(arm.noInf)window.unlockInfs=()=>{};
    const savedClear=window.afterClear;
    if(arm.breach)window.afterClear=breachAfterClear(arm.breach);
    // Test-only what-if: a price multiplier for players with nothing on file (no shared data, no Fair Play). The game has none.
    const savedMult=window.priceMult,onFile=()=>!!(S.member||TYPES.some(t=>S.shared[t]));
    if(arm.markup!=null)window.priceMult=pk=>{const m=savedMult(pk);return onFile()?m:m*arm.markup};
    const harmOff=harmOn(arm),splitOff=arm.split?splitOn():null;
    for(const k in sfx)sfx[k]=()=>{};
    Math.random=rng(seed);vclock=0;performance.now=()=>vclock;W=ARENA.w;H=ARENA.h;
    for(const k in keys)keys[k]=false;dashReq=false;
    const r={seed,arm:arm.name,cleared:0,survived:false,score:0,hits:0,kills:0,coins:0,spent:0,fairPaid:0,got:0,forced:0,cantAfford:0,
      shares:0,types:0,infs:0,wifiCoins:0,breachLost:0,wifiT:0,halo:false,mayday:false,maydayFail:false,breaches:0,weight:0,hFound:0,hKnown:0,hCut:0,hShort:0,steps:0,error:''};
    const bot={arm,r,skill:SKILL[arm.skill]||SKILL.average,rng:rng(seed^0x5bd1e995),seen:new WeakMap(),step:0};
    try{
      beginRun();
      if(arm.inf)for(const k of arm.inf)S.inf[k]=true;
      // What-if: credits every player starts the run with (the game uses START_COINS).
      if(arm.startCoins!=null)S.coins=arm.startCoins;
      const cap=60*60*(maxWave*3+10),until=realNow()+20000;
      for(;bot.step<cap;bot.step++){
        if(!(bot.step&1023)&&realNow()>until)throw new Error('run took over 20s at wave '+S.wave+' in mode '+S.mode);
        if(S.mode==='dead'||S.mode==='dossier')break;
        if(S.wave>maxWave){r.survived=true;break}
        if(S.readHold){dismissRead();continue}
        if(S.mode==='terms'){shop(bot);continue}
        if(S.mode==='reveal'){nextReveal();continue}
        if(S.mode==='safety'){if(arm.halo)acceptSafetyAsk();else declineSafetyAsk();continue}
        S.paused=false;
        drive(bot);
        if(S.freeze>0)S.freeze-=DT;
        else{update(DT);if(S.mode!=='terms'&&S.mode!=='reveal')updateFX(DT)}
        vclock+=DT*1000;
      }
      r.cleared=r.survived?maxWave:Math.max(0,S.wave-1);
    }catch(e){r.error=e&&e.message||String(e);r.cleared=Math.max(0,(S&&S.wave||1)-1)}
    finally{
      if(S){
        const T=S.tele;
        Object.assign(r,{score:S.score,hits:T.hits,kills:T.kills,coins:S.coins,
          shares:TYPES.reduce((a,t)=>a+(S.shared[t]||0),0),types:TYPES.filter(t=>S.shared[t]).length,infs:INF.filter(f=>S.inf[f.id]).length,
          wifiCoins:T.wifiCoins||0,breachLost:T.breachLost||0,wifiT:+(T.wifiT||0).toFixed(1),halo:!!S.safetyOn,mayday:!!T.emergDirect,maydayFail:!!T.distressFail,breaches:T.breaches||0,steps:bot.step,
          weight:TYPES.filter(t=>S.shared[t]).length+INF.filter(f=>S.inf[f.id]).length,hFound:T.hFound||0,hKnown:T.hKnown||0,hCut:T.hCut||0,hShort:T.hShort||0});
      }
      harmOff();if(splitOff)splitOff();
      window.unlockInfs=savedUnlock;window.priceMult=savedMult;window.afterClear=savedClear;
      Object.assign(sfx,savedSfx);Math.random=realRandom;performance.now=realNow;W=sW;H=sH;
      for(const k in keys)keys[k]=false;dashReq=false;
      clearInterval(urgencyTimer);
      S=null;
      $('logFeed').innerHTML='';
    }
    return r;
  }

  // ---- experiments ----
  const BASE={cards:{},others:'buy',halo:false,fair:false,read:0,skill:'average',force:[],crowd:0,packs:null,start:null,inf:null,noInf:false,markup:null,hotspot:true,shareOnly:null,breach:null,harm:null,noHarm:false,split:false,startCoins:null};
  function armOf(x,a){
    const o=Object.assign({},BASE,{skill:x.skill||BASE.skill,others:x.others||BASE.others,halo:x.halo!=null?x.halo:BASE.halo,force:x.force||[]},a);
    o.force=[...new Set([...(o.force||[]),...Object.keys(o.cards||{}).filter(()=>x.forceCards)])];
    return o;
  }
  const VERB={free:'Accept',pay:'Buy',skip:'Skip'};
  // The five players the sharing target is about, all with the same breach rules.
  function breachArms(B){return [
    {name:'All-in',others:'share',breach:B},{name:'Selective · Location + Habits',others:'share',shareOnly:['LOC','HAB'],breach:B},
    {name:'Selective · Location only',others:'share',shareOnly:['LOC'],breach:B},{name:'Non-sharer',others:'buy',breach:B},
    {name:'Careful non-sharer (expert)',others:'buy',skill:'expert',breach:B}]}
  const PRESETS=[
    {name:'THRUST: Accept, Buy, or Skip',about:'THRUST is put in every shop. Other cards are bought when affordable, never shared.',
      runs:30,waves:15,forceCards:true,arms:[{name:'Accept THRUST',cards:{route:'free'}},{name:'Buy THRUST',cards:{route:'pay'}},{name:'Skip THRUST',cards:{route:'skip'}}]},
    {name:'Share everything vs. share nothing',about:'Every data card Accepted, or every card paid for. Same seeds.',
      runs:30,waves:15,arms:[{name:'Share everything',others:'share'},{name:'Share nothing',others:'buy'}]},
    {name:'Leaderboard overlap',about:'Can a careful non-sharer beat a careless sharer? The percentage in "Beats" is the chance a run out-scores a run of the first option, as the leaderboard ranks them. Compare players of the same skill, and a careful non-sharer against an average sharer.',
      runs:40,waves:15,arms:[{name:'Average sharer',others:'share',skill:'average'},{name:'Average non-sharer',others:'buy',skill:'average'},{name:'Careful non-sharer',others:'buy',skill:'expert'},{name:'Careless sharer',others:'share',skill:'novice'}]},
    {name:'Where the sharing gap comes from',about:'Takes the sharing advantage apart. "Share everything" is the baseline. No inferences: sharing still gives free upgrades, but no inference ever unlocks. Share nothing: pays for everything. Fair Play: pays per wave, no sharing. Fair Play: pays per wave, no sharing.',
      runs:30,waves:20,arms:[{name:'Share everything',others:'share'},{name:'Share everything, no inferences',others:'share',noInf:true},{name:'Share nothing',others:'buy'},{name:'Fair Play',others:'buy',fair:true}]},
    {name:'How much to share',about:'All-in sharers against selective sharers and non-sharers. Selective sharers Accept only the data cards for the types listed and pay for the rest. Target: selective sharers do best, and non-sharers can beat all-in sharers. "Beats" is the chance a run out-scores an all-in run.',
      runs:24,waves:30,arms:[{name:'All-in (share every type)',others:'share'},{name:'Selective · Location + Habits',others:'share',shareOnly:['LOC','HAB']},{name:'Selective · Health + Purchases',others:'share',shareOnly:['HEA','PUR']},{name:'Selective · Location only',others:'share',shareOnly:['LOC']},{name:'Selective · Purchases only',others:'share',shareOnly:['PUR']},{name:'Non-sharer',others:'buy'}]},
    {name:'Breach what-if',about:'Test-only. Breach chance counts shared data fully and hotspot exposure at 30%, rises 8 points per type past two, and each breach takes 10% of your credits per leaked type. Target: selective sharers do best, and non-sharers can beat all-in sharers.',
      runs:20,waves:30,arms:breachArms({wifiW:.3,typeBoost:.08,credits:.1})},
    {name:'File harms on vs. off',about:'The game\'s harms grow with your file (types shared + inferences). "Off" turns the growth and the new harms off. Same seeds.',
      runs:24,waves:30,arms:[{name:'All-in, harms on',others:'share'},{name:'All-in, harms off',others:'share',noHarm:true},{name:'Non-sharer, harms on',others:'buy'},{name:'Non-sharer, harms off',others:'buy',noHarm:true}]},
    {name:'Starting credits',about:'Every player starts with '+START_COINS+' credits. Compare with starting at 0. Same seeds.',
      runs:24,waves:30,arms:[{name:'Non-sharer, '+START_COINS+' credits',others:'buy'},{name:'Non-sharer, 0 credits',others:'buy',startCoins:0},{name:'All-in, '+START_COINS+' credits',others:'share'},{name:'All-in, 0 credits',others:'share',startCoins:0}]},
    {name:'Halo on vs. off',about:'Turn Halo on when it is offered, or decline and rely on mayday.',
      runs:30,waves:15,arms:[{name:'Halo on',halo:true},{name:'Halo off',halo:false}]},
    {name:'Fair Play vs. paying per card',about:'Subscribe at the first shop that can afford it, or never. Both pay for cards, never share.',
      runs:30,waves:15,arms:[{name:'Fair Play',fair:true},{name:'No Fair Play'}]},
    {name:'Bot skill check',about:'The same strategy at each bot skill. Use it to see how much skill matters next to any choice.',
      runs:20,waves:15,arms:[{name:'Novice',skill:'novice'},{name:'Average',skill:'average'},{name:'Expert',skill:'expert'}]}
  ];

  let stopFlag=false,busy=false;
  async function runExperiment(x,onProgress){
    const arms=x.arms.map(a=>armOf(x,a)),runs=x.runs||30,waves=x.waves||15,base=x.seed||1000;
    const res=arms.map(()=>[]);const t0=realNow();
    stopFlag=false;
    for(let i=0;i<runs&&!stopFlag;i++){
      for(let j=0;j<arms.length;j++)res[j].push(playRun(arms[j],base+i,waves));
      if(onProgress)onProgress((i+1)/runs,i+1,runs);
      await new Promise(r=>setTimeout(r,0));
    }
    return {x,arms,res,waves,secs:(realNow()-t0)/1000,stopped:stopFlag};
  }

  // ---- stats ----
  const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
  function ci(a){if(a.length<2)return 0;const m=mean(a),sd=Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));return 1.96*sd/Math.sqrt(a.length)}
  function median(a){const b=[...a].sort((x,y)=>x-y),n=b.length;return n?(n%2?b[n>>1]:(b[n/2-1]+b[n/2])/2):0}
  const f1=v=>(Math.round(v*10)/10).toFixed(1),sg=v=>(v>0?'+':v<0?'−':'±')+f1(Math.abs(v));
  // Chance that a run from one option out-scores a run from another, as the leaderboard would rank them. Ties count half.
  function beats(a,b){let w=0;for(const x of a)for(const y of b)w+=x>y?1:x===y?.5:0;return a.length&&b.length?w/(a.length*b.length):0}
  function paired(a,b){const d=a.map((r,i)=>r-b[i]);return {m:mean(d),c:ci(d)}}
  function verdict(d,unit){
    if(!d.c&&!d.m)return 'same';
    if(d.m-d.c>0)return 'better by '+f1(d.m)+' '+unit;
    if(d.m+d.c<0)return 'worse by '+f1(-d.m)+' '+unit;
    return 'no clear difference';
  }
  function summarize(out){
    const ref=out.res[0];
    return out.arms.map((a,j)=>{
      const R=out.res[j],w=R.map(r=>r.cleared),s=R.map(r=>r.score);
      return {arm:a,R,w,n:R.length,wm:mean(w),wc:ci(w),wmed:median(w),sm:mean(s),sc:ci(s),
        surv:mean(R.map(r=>r.survived?1:0)),hits:mean(R.map(r=>r.hits)),spent:mean(R.map(r=>r.spent)),lost:mean(R.map(r=>r.breachLost)),wifi:mean(R.map(r=>r.wifiCoins)),coins:mean(R.map(r=>r.coins)),
        got:mean(R.map(r=>r.got)),cant:mean(R.map(r=>r.cantAfford)),types:mean(R.map(r=>r.types)),infs:mean(R.map(r=>r.infs)),
        breaches:mean(R.map(r=>r.breaches)),mayday:mean(R.map(r=>r.mayday?1:0)),errors:R.filter(r=>r.error).length,
        beat:j?beats(s,ref.map(r=>r.score)):null,
        dw:j?paired(w,ref.map(r=>r.cleared)):null,ds:j?paired(s,ref.map(r=>r.score)):null};
    });
  }
  function asText(out){
    const rows=summarize(out),tracked=Object.keys(Object.assign({},...out.arms.map(a=>a.cards))).length>0;
    let t='## '+out.x.name+'\n'+out.x.about+'\n'+rows[0].n+' runs per option, stop at wave '+out.waves+', bot skill '+out.arms[0].skill+'.\n\n';
    t+='| Option | Waves cleared | vs. first | Score | Beats a '+out.arms[0].name+' run | Hits | Reached '+out.waves+' |'+(tracked?' Card taken | Couldn\'t afford |':'')+' Hotspot credits | Breaches | Credits lost to breaches | Data types | Inferences |\n';
    t+='|---|---|---|---|---|---|---|'+(tracked?'---|---|':'')+'---|---|---|---|---|\n';
    for(const r of rows)t+='| '+r.arm.name+' | '+f1(r.wm)+' ±'+f1(r.wc)+' | '+(r.dw?sg(r.dw.m)+' ±'+f1(r.dw.c)+' ('+verdict(r.dw,'waves')+')':'—')+' | '+Math.round(r.sm)+' | '+(r.beat==null?'—':Math.round(r.beat*100)+'%')+' | '+f1(r.hits)+' | '+Math.round(r.surv*100)+'% |'+(tracked?' '+f1(r.got)+' | '+f1(r.cant)+' |':'')+' '+Math.round(r.wifi)+' | '+f1(r.breaches)+' | '+Math.round(r.lost)+' | '+f1(r.types)+' | '+f1(r.infs)+' |\n';
    return t;
  }

  // ---- card league ----
  // Every card against the same baseline (shops with nothing forced), at each bot skill, on the same seeds.
  // A card's value is the waves it adds or costs compared with that baseline. "Balanced" here means every card sits
  // close to the middle of the pack: not far ahead of the others, and not behind them everywhere.
  const SKILLS=['novice','average','expert'];
  async function runLeague(o,onProgress){
    o=o||{};const runs=o.runs||40,waves=o.waves||20,tol=o.tol==null?1:o.tol,start=o.start||{HAB:1,LOC:1};
    const arms=[{name:'No forced card',cards:{},start}];
    const skipped=[];
    for(const pk of PERKS){
      if(pk.from&&pk.from>waves){skipped.push(pk.name+' (first offered at wave '+pk.from+')');continue}
      arms.push({name:pk.name+' · Buy',card:pk.id,cards:{[pk.id]:'pay'},start});
      if(pk.data)arms.push({name:pk.name+' · Accept',card:pk.id,cards:{[pk.id]:'free'},start});
    }
    const outs=[];stopFlag=false;const t0=realNow();
    for(let k=0;k<SKILLS.length&&!stopFlag;k++){
      const x={name:'Card league ('+SKILLS[k]+')',about:'',runs,waves,others:'buy',skill:SKILLS[k],forceCards:true,arms};
      outs.push(await runExperiment(x,(f,i,n)=>{if(onProgress)onProgress((k+f)/SKILLS.length,SKILLS[k],i,n)}));
    }
    // Per option: value at each skill, value relative to the middle card at that skill, and a verdict.
    const names=outs.length?outs[0].arms.slice(1).map(a=>a.name):[];
    const sums=outs.map(out=>summarize(out).slice(1));
    const med=sums.map(S2=>median(S2.map(r=>r.dw.m)));
    // A skill where the baseline reaches the stop wave almost every run can't show differences. It is left out of the verdict.
    const ceil=outs.map(out=>summarize(out)[0].wm>=waves-.3);
    const rows=names.map((name,j)=>{
      const cells=sums.map((S2,k)=>({m:S2[j].dw.m,c:S2[j].dw.c,rel:S2[j].dw.m-med[k],errors:S2[j].errors,ceil:ceil[k]}));
      const live=cells.filter(c=>!c.ceil).length?cells.filter(c=>!c.ceil):cells;
      const rel=mean(live.map(c=>c.rel)),m=mean(live.map(c=>c.m));
      const same=live.every(c=>c.rel>0)?1:live.every(c=>c.rel<0)?-1:0;
      const verdict=rel>tol?'ahead':rel<-tol?'behind':'in line';
      const trap=rel<-tol&&same<0,sure=live.every(c=>Math.abs(c.rel)>c.c);
      return {name,cells,m,rel,verdict,trap,sure,errors:cells.reduce((a,c)=>a+c.errors,0)};
    }).sort((a,b)=>b.rel-a.rel);
    return {rows,tol,runs,waves,med,ceil,skipped,secs:(realNow()-t0)/1000,stopped:stopFlag,skills:SKILLS.slice(0,outs.length)};
  }
  function leagueText(L){
    let t='## Card league\n'+L.runs+' runs per option per skill, stop at wave '+L.waves+', tolerance ±'+L.tol+' waves. Value = waves vs. shops with nothing forced. "vs. middle" = value minus the middle card at that skill.\n\n';
    t+='| Option | '+L.skills.map(k=>k).join(' | ')+' | vs. middle | Verdict |\n|---|'+L.skills.map(()=>'---|').join('')+'---|---|\n';
    for(const r of L.rows)t+='| '+r.name+' | '+r.cells.map(c=>c.ceil?'maxed out':sg(c.m)+' ±'+f1(c.c)).join(' | ')+' | '+sg(r.rel)+' | '+r.verdict+(r.trap?' (behind at every skill)':'')+(r.sure?'':' (unsure)')+' |\n';
    return t;
  }
  function leagueCard(L){
    const box=document.createElement('section');box.className='bres';
    box.innerHTML=`<h2>Card league</h2><p class="babout">Every card against shops with nothing forced, at each bot skill, on the same seeds. Value is waves gained or lost. Sorted by distance from the middle card.</p>
<p class="bmeta">${L.runs} runs per option per skill · stop at wave ${L.waves} · tolerance ±${L.tol} waves · ${f1(L.secs/60)} min${L.stopped?' · <b>stopped early</b>':''}</p>
<div class="btable"><table><thead><tr><th>Option</th>${L.skills.map(k=>`<th>${k}</th>`).join('')}<th>vs. middle</th><th>Verdict</th></tr></thead><tbody>
${L.rows.map(r=>`<tr><td>${esc(r.name)}</td>${r.cells.map(c=>c.ceil?'<td class="bdim">maxed out</td>':`<td><span class="${c.m-c.c>0?'bgood':c.m+c.c<0?'bbad':'bdim'}">${sg(c.m)}</span> <span class="bdim">±${f1(c.c)}</span></td>`).join('')}<td><b>${sg(r.rel)}</b></td><td><span class="${r.verdict==='ahead'?'bgood':r.verdict==='behind'?'bbad':'bdim'}">${r.verdict}</span>${r.trap?' <span class="bbad">at every skill</span>':''}${r.sure?'':' <span class="bdim">· unsure</span>'}</td></tr>`).join('')}
</tbody></table></div>
<p class="bfoot">Value: green or red when the range excludes zero. “vs. middle” averages each skill’s gap to its middle card. “Unsure”: at some skill the gap is smaller than the range. ${L.ceil.some(x=>x)?'“Maxed out”: the baseline reached the stop wave nearly every run, so that skill is left out of the verdict. ':''}${L.skipped.length?'Not tested: '+esc(L.skipped.join(', '))+'. ':''}Errors: ${L.rows.reduce((a,r)=>a+r.errors,0)} runs. <button class="bcopy">Copy as text</button></p>`;
    box.querySelector('.bcopy').onclick=e=>{navigator.clipboard.writeText(leagueText(L)).then(()=>{e.target.textContent='Copied'},()=>{e.target.textContent='Copy failed'})};
    return box;
  }

  // ---- page ----
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function strip(r,max,col){
    const w=150,h=22,pts=r.w.map((v,i)=>{const x=4+(v/max)*(w-8),y=4+((i*7919)%13)/13*(h-8);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${col}" fill-opacity=".7"/>`}).join('');
    const m=4+(r.wm/max)*(w-8);
    return `<svg class="bstrip" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="4" x2="${w-4}" y1="${h-2}" y2="${h-2}" stroke="#2a2f55"/>${pts}<line x1="${m}" x2="${m}" y1="1" y2="${h-1}" stroke="#fff" stroke-width="2"/></svg>`;
  }
  const COLS=['#38e1ff','#ffd23b','#ff6bd6','#7dff6a','#ff9a5a'];
  function card(out){
    const rows=summarize(out),tracked=Object.keys(Object.assign({},...out.arms.map(a=>a.cards))).length>0;
    const errs=rows.reduce((a,r)=>a+r.errors,0);
    const box=document.createElement('section');box.className='bres';
    box.innerHTML=`<h2>${esc(out.x.name)}</h2><p class="babout">${esc(out.x.about||'')}</p>
<p class="bmeta">${rows[0].n} runs per option · stop at wave ${out.waves} · ${esc(out.arms[0].skill)} bot · ${f1(out.secs)}s${out.stopped?' · <b>stopped early</b>':''}${errs?` · <b class="bbad">${errs} runs threw an error</b>`:''}</p>
<div class="btable"><table><thead><tr><th>Option</th><th>Waves cleared</th><th></th><th>vs. ${esc(rows[0].arm.name)}</th><th>Score</th><th>Beats a ${esc(rows[0].arm.name)} run</th><th>Hits</th><th>Reached ${out.waves}</th>${tracked?'<th>Card taken</th><th>Couldn’t afford</th>':''}<th>Credits spent</th><th>Hotspot credits</th><th>Breaches</th><th>Credits lost to breaches</th><th>Data types</th><th>Inferences</th></tr></thead><tbody>
${rows.map((r,j)=>`<tr><td><i class="bdot" style="background:${COLS[j%COLS.length]}"></i>${esc(r.arm.name)}</td><td><b>${f1(r.wm)}</b> <span class="bdim">±${f1(r.wc)}</span></td><td>${strip(r,out.waves,COLS[j%COLS.length])}</td>
<td>${r.dw?`<span class="${r.dw.m-r.dw.c>0?'bgood':r.dw.m+r.dw.c<0?'bbad':'bdim'}">${sg(r.dw.m)} ±${f1(r.dw.c)}</span><div class="bv">${verdict(r.dw,'waves')}</div>`:'<span class="bdim">baseline</span>'}</td>
<td>${Math.round(r.sm)}${r.ds?`<div class="bv">${verdict(r.ds,'pts')}</div>`:''}</td><td>${r.beat==null?'<span class="bdim">—</span>':Math.round(r.beat*100)+'%'}</td><td>${f1(r.hits)}</td><td>${Math.round(r.surv*100)}%</td>
${tracked?`<td>${f1(r.got)}</td><td>${f1(r.cant)}</td>`:''}<td>${Math.round(r.spent)}</td><td>${Math.round(r.wifi)}</td><td>${f1(r.breaches)}</td><td>${Math.round(r.lost)}</td><td>${f1(r.types)}</td><td>${f1(r.infs)}</td></tr>`).join('')}
</tbody></table></div>
<p class="bfoot">Waves cleared: average ±95% range. Each dot is one run; the white line is the average. “Beats” is the chance a run out-scores a run of the first option, the way the leaderboard ranks them. “vs.” compares each run with the first option on the same seed, so luck cancels out. <button class="bcopy">Copy as text</button></p>`;
    box.querySelector('.bcopy').onclick=e=>{navigator.clipboard.writeText(asText(out)).then(()=>{e.target.textContent='Copied'},()=>{e.target.textContent='Copy failed'})};
    return box;
  }

  function page(){
    ['hud','title','terms','reveal','pause','dossier','safetyAsk'].forEach(id=>{const e=$(id);if(e)e.classList.add('hidden')});
    const el=document.createElement('div');el.id='botLab';
    const cardOpts=PERKS.map(p=>`<option value="${p.id}">${p.name}${p.data?' · '+DATA[p.data].n:''}</option>`).join('');
    el.innerHTML=`<style>
#botLab{position:fixed;inset:0;z-index:9999;overflow:auto;background:#0b0c18;color:#d5dcf5;font:14px/1.45 'JetBrains Mono',ui-monospace,monospace;padding:24px 16px}
#botLab .wrap{max-width:1040px;margin:0 auto}
#botLab h1{font:700 22px/1.2 system-ui,sans-serif;margin:0 0 4px;color:#fff}
#botLab h2{font:700 16px/1.3 system-ui,sans-serif;margin:0 0 2px;color:#fff}
#botLab .bsub{color:#8a93b8;margin:0 0 18px}
#botLab .bpanel{border:1px solid #232850;border-radius:10px;padding:14px;margin:0 0 16px;background:#10122a}
#botLab .bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 14px}
#botLab label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#8a93b8}
#botLab select,#botLab input[type=number]{background:#0b0c18;color:#fff;border:1px solid #2a2f55;border-radius:6px;padding:6px 8px;font:inherit}
#botLab .bchecks{display:flex;gap:12px;flex-wrap:wrap;color:#d5dcf5;font-size:13px}
#botLab .bchecks label{flex-direction:row;align-items:center;color:#d5dcf5;font-size:13px}
#botLab button{background:#38e1ff;color:#0b0c18;border:0;border-radius:6px;padding:7px 14px;font:700 13px system-ui,sans-serif;cursor:pointer}
#botLab button.bghost{background:transparent;color:#38e1ff;border:1px solid #2a2f55}
#botLab button:disabled{opacity:.4;cursor:default}
#botLab .bpresets{display:flex;gap:8px;flex-wrap:wrap}
#botLab .bline{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
#botLab .bprog{flex:1;min-width:160px;height:6px;background:#1d2140;border-radius:3px;overflow:hidden}
#botLab .bprog i{display:block;height:100%;width:0;background:#38e1ff}
#botLab .bstat{color:#8a93b8;font-size:12px}
#botLab .bres{border:1px solid #232850;border-radius:10px;padding:14px;margin:0 0 16px}
#botLab .babout{margin:0;color:#b7bfdf}#botLab .bmeta{margin:2px 0 10px;color:#8a93b8;font-size:12px}
#botLab .btable{overflow-x:auto}
#botLab table{border-collapse:collapse;width:100%;font-size:13px}
#botLab th{text-align:left;font-weight:400;color:#8a93b8;font-size:11px;padding:4px 8px;border-bottom:1px solid #232850;white-space:nowrap}
#botLab td{padding:6px 8px;border-bottom:1px solid #1a1e3a;vertical-align:top;white-space:nowrap}
#botLab .bdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
#botLab .bdim{color:#8a93b8}#botLab .bgood{color:#7dff6a}#botLab .bbad{color:#ff6b6b}
#botLab .bv{font-size:11px;color:#8a93b8}
#botLab .bfoot{font-size:12px;color:#8a93b8;margin:10px 0 0}
#botLab .bfoot button{margin-left:8px;padding:3px 10px;font-size:12px}
#botLab a{color:#38e1ff}
</style><div class="wrap">
<h1>OPT/IN bot lab</h1>
<p class="bsub">Bots play real runs with no drawing. Each option plays the same seeds, so differences come from the choice. Nothing is saved.</p>
<div class="bpanel"><h2>Compare a card</h2><p class="bsub" style="margin-bottom:10px">The card is put in every shop so each run faces the choice.</p>
<div class="bgrid">
<label>Card<select id="bCard">${cardOpts}</select></label>
<label>Options to compare<span class="bchecks"><label><input type="checkbox" id="bFree" checked>Accept</label><label><input type="checkbox" id="bPay" checked>Buy</label><label><input type="checkbox" id="bSkip" checked>Skip</label></span></label>
<label>Every other card<select id="bOthers"><option value="buy">Buy if affordable, never share</option><option value="share">Accept data cards, buy the rest</option><option value="skip">Take nothing else</option></select></label>
<label>Halo<select id="bHalo"><option value="0">Decline (mayday)</option><option value="1">Turn on</option></select></label>
<label>Bot skill<select id="bSkill"><option>average</option><option>novice</option><option>expert</option></select></label>
<label>Runs per option<input type="number" id="bRuns" value="30" min="2" max="500"></label>
<label>Stop at wave<input type="number" id="bWaves" value="15" min="2" max="60"></label>
</div>
<div class="bline"><button id="bGo">Run</button><span class="bstat" id="bHint"></span></div></div>
<div class="bpanel"><h2>Card league</h2><p class="bsub" style="margin-bottom:10px">Every card against the same baseline at all three bot skills. The middle card is the yardstick. Stops at wave 20. Takes about 20–30 minutes at 30 runs.</p>
<div class="bgrid"><label>Runs per option<input type="number" id="bLRuns" value="30" min="5" max="200"></label><label>Tolerance (waves from the middle)<input type="number" id="bTol" value="1" min=".2" max="5" step=".1"></label></div>
<div class="bline"><button id="bLeague">Run the league</button></div></div>
<div class="bpanel"><h2>Ready-made tests</h2><div class="bpresets" style="margin-top:8px">${PRESETS.map((p,i)=>`<button class="bghost" data-i="${i}">${esc(p.name)}</button>`).join('')}</div></div>
<div class="bline" style="margin:0 0 16px"><div class="bprog"><i id="bBar"></i></div><span class="bstat" id="bStat">Idle.</span><button class="bghost" id="bStop" disabled>Stop</button></div>
<div id="bOut"></div>
<p class="bstat">Console: <code>bots.run({name, runs, waves, others, halo, skill, forceCards, arms:[{name, cards:{route:'free'}}, …]})</code>. Arm options: cards, others, halo, fair, read (seconds in each shop), skill, force, crowd (seeded class runs), packs, start (data on file), inf. See TESTING.md.</p>
</div>`;
    document.body.appendChild(el);
    const q=id=>el.querySelector('#'+id);
    const sync=()=>{const pk=perk(q('bCard').value),f=q('bFree');f.disabled=!pk.data;if(!pk.data)f.checked=false;else if(!f.dataset.t)f.checked=true;
      q('bHint').textContent=pk.data?'':pk.name+' has no data, so it can only be bought. Accept is for data cards.'};
    q('bCard').onchange=sync;sync();
    q('bGo').onclick=()=>{
      const id=q('bCard').value,pk=perk(id),acts=[['free',q('bFree').checked],['pay',q('bPay').checked],['skip',q('bSkip').checked]].filter(a=>a[1]).map(a=>a[0]).filter(a=>a!=='free'||pk.data);
      if(acts.length<2){q('bStat').textContent='Pick at least two options.';return}
      go({name:pk.name+': '+acts.map(a=>VERB[a]).join(' vs. '),about:pk.name+' is put in every shop. Every other card: '+q('bOthers').selectedOptions[0].textContent.toLowerCase()+'. Halo '+(q('bHalo').value==='1'?'on':'declined')+'.',
        runs:+q('bRuns').value||30,waves:+q('bWaves').value||15,others:q('bOthers').value,halo:q('bHalo').value==='1',skill:q('bSkill').value,forceCards:true,
        arms:acts.map(a=>({name:VERB[a]+' '+pk.name,cards:{[id]:a}}))});
    };
    el.querySelectorAll('.bpresets button').forEach(b=>b.onclick=()=>go(Object.assign({},PRESETS[+b.dataset.i],{runs:+q('bRuns').value||PRESETS[+b.dataset.i].runs,waves:+q('bWaves').value||PRESETS[+b.dataset.i].waves,skill:PRESETS[+b.dataset.i].arms.some(a=>a.skill)?undefined:q('bSkill').value})));
    q('bStop').onclick=()=>{stopFlag=true};
    q('bLeague').onclick=async()=>{
      if(busy)return;busy=true;
      el.querySelectorAll('button:not(#bStop):not(.bcopy)').forEach(b=>b.disabled=true);q('bStop').disabled=false;
      try{
        const L=await runLeague({runs:+q('bLRuns').value||30,tol:+q('bTol').value||1},(f,sk,i,n)=>{q('bBar').style.width=(f*100)+'%';q('bStat').textContent='League · '+sk+' · seed '+i+' of '+n});
        lastLeague=L;q('bOut').prepend(leagueCard(L));q('bStat').textContent='League done in '+f1(L.secs/60)+' min.';
      }catch(e){q('bStat').textContent='Error: '+(e&&e.message||e)}
      finally{busy=false;el.querySelectorAll('button').forEach(b=>b.disabled=false);q('bStop').disabled=true}
    };
    async function go(x){
      if(busy)return;busy=true;
      el.querySelectorAll('button:not(#bStop):not(.bcopy)').forEach(b=>b.disabled=true);q('bStop').disabled=false;
      q('bStat').textContent='Running '+x.name+'…';q('bBar').style.width='0';
      try{
        const out=await runExperiment(x,(f,i,n)=>{q('bBar').style.width=(f*100)+'%';q('bStat').textContent=x.name+' · '+i+' of '+n+' seeds'});
        q('bOut').prepend(card(out));q('bStat').textContent='Done in '+f1(out.secs)+'s.';
        last=out;
      }catch(e){q('bStat').textContent='Error: '+(e&&e.message||e)}
      finally{busy=false;el.querySelectorAll('button').forEach(b=>b.disabled=false);q('bStop').disabled=true}
    }
    window.bots.go=go;
  }

  let last=null,lastLeague=null;
  window.bots={
    league:async o=>{if(busy)return null;busy=true;try{const L=await runLeague(o);lastLeague=L;const b=$('bOut');if(b)b.prepend(leagueCard(L));return L}finally{busy=false}},
    leagueText:()=>lastLeague?leagueText(lastLeague):'',
    run:async x=>{const out=await runExperiment(x);last=out;const o=$('bOut');if(o)o.prepend(card(out));return summarize(out).map(r=>({option:r.arm.name,waves:+f1(r.wm),ci:+f1(r.wc),vsFirst:r.dw?verdict(r.dw,'waves'):'baseline',score:Math.round(r.sm),hits:+f1(r.hits),errors:r.errors}))},
    playRun:(arm,seed,waves)=>playRun(armOf({},arm||{}),seed||1,waves||15),
    presets:PRESETS,breachArms,text:()=>last?asText(last):'',raw:()=>last,stop:()=>{stopFlag=true},SKILL
  };
  S=null;
  page();
})();
