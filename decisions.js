// OPT/IN decisions page. Open decisions.html (or index.html?decisions).
// Every choice a player can make, with what each option gets them and what it costs them.
//
// Most of this is read live from the game's own tables (DATA, PERKS, INF, BEH, PACKS), so it cannot fall behind.
// The hand-written parts below describe game text or code. Each one is stamped with a fingerprint of the text
// or code it describes (STAMPS). When that changes, the entry shows OUT OF DATE here and checks.js fails,
// until someone reviews the wording and re-stamps:
//   1. Open the page and read what is flagged. Fix the wording in this file.
//   2. In the browser console run decisionsStamp(), and paste the result over STAMPS at the bottom.
// When a decision point is added, removed, or changed in index.html, update this file in the same change.
'use strict';
(function(){
  // ---- fingerprints ----
  const fp=s=>{s=String(s).replace(/\s+/g,' ');let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)};
  const look=expr=>{try{return Function('return '+expr)()}catch(e){return undefined}};
  // The fine print needs a run for its secret word, so one is borrowed when the page opens with none.
  function clauses(){
    const had=S;if(!S)S={secret:'FINEPRINT'};
    try{
      const d=document.createElement('div');d.innerHTML=fineText();const o={};
      for(const p of d.children){const b=p.querySelector('b');if(b)o[b.textContent.split('.')[0].trim()]=p.textContent}
      return o;
    }finally{S=had}
  }
  // The text or code an entry describes. Names: fn:<function>, const:<constant>, fine:<clause>, inf:<inference id>.
  function source(name){
    const i=name.indexOf(':'),k=name.slice(0,i),v=name.slice(i+1);
    if(k==='fn'){const f=look(v);return typeof f==='function'?String(f):null}
    if(k==='const'){const x=look(v);return x===undefined?null:JSON.stringify(x)}
    if(k==='fine'){const c=clauses();return c[v]==null?null:c[v]}
    if(k==='inf'){const f=INF.find(x=>x.id===v);return f?f.desc:null}
    return null;
  }

  // ---- wording that is not in the game's tables ----
  // What each class model does to every player, and what its pack sells back.
  const CLASS={
    LOC:{neg:'Ships are sent where the class lingers.',pos:'A hit map shows where the class gets hit.'},
    HAB:{neg:'Extra shots cover the side the class dodges toward.',pos:'The shop marks the upgrade the class picks first.'},
    HEA:{neg:'Ships press harder at the heart count where the class gets hit most.',pos:'A 1-hit check-in shield at that heart count, once a wave.'},
    PUR:{neg:'The class bestseller takes a shop seat.',pos:'30% off the offered upgrade the class buys least.'}
  };
  // What each inference does in play, split into what it costs and what it gives.
  const INF_SPLIT={
    predict:{neg:'Ships aim where you will be, not where you are, and some fly there. More of them on a bigger file.',pos:'50% more warning before ships arrive.'},
    risk:{neg:'Take more than 1 hit a wave and prices are 50% higher, Halo brings you back with 1♥ less, and a mayday takes 2 seconds longer.',pos:'Prices are 20% lower if you take 1 hit or less a wave.'},
    retreat:{neg:'At 2♥ or less, about half of new ships spawn near the spot you go when hurt, more on a bigger file.',pos:'A mayday brings help 2 seconds sooner.'},
    home:{neg:'Ships spawn closer to you, with less warning. Even less on a bigger file.',pos:'Every 3rd wave starts with a 1-hit shield.'},
    needs:{neg:'At 2♥ or less, PLATING and RESERVE cost 50% more, and every repair heals 1♥ less (from 3♥ on a big file).',pos:'At 2♥ or less, the shop always stocks one of them.'},
    impulse:{neg:'Offer timers drop to 5 seconds, and buying before one ends costs 25% more.',pos:'Buying an upgrade again returns 70% of its price instead of 40%.'}
  };

  // ---- build the page's content ----
  // An entry: {id, section, title, where, src, choices:[{label, pos, neg, also}]}
  function build(){
    const out=[],add=(id,section,title,where,src,choices,note)=>out.push({id,section,title,where,src,choices,note});
    const other=(f,t)=>DATA[f.need.find(x=>x!==t)].n;

    // Shop: one entry per data upgrade.
    for(const t of TYPES)for(const pk of PERKS.filter(p=>p.data===t)){
      const D=DATA[t],c=CLASS[t]||{neg:'(class wording missing)',pos:''},inf=INF.filter(f=>f.need.includes(t));
      add('data-'+t,'Shop · upgrades that ask for data',pk.name+' · '+D.n,'Every shop offer that asks for '+D.n+'. Accept it free, or pay credits.',
        ['fine:2','fine:2b','fine:3','fine:4','fn:choose','fn:exposure','fn:priceMult','fn:fileWeight','fn:harmScale','const:HARM','const:START_COINS','fn:harmFound','fn:weakHp','fn:patternKeep','fn:buildKnown'],[
        {label:'ACCEPT · FREE · shares '+D.n,
          pos:['Free '+pk.name+': '+pk.desc,'Costs no credits.',...D.good.map(g=>'Real world: '+g)],
          neg:[...D.why.map(g=>'Real world: '+g),'Joins the class model, which is used on every player: '+c.neg,
            'Can combine with another type into an inference: '+inf.map(f=>f.name+' (with '+other(f,t)+')').join(', ')+'.',
            'Your file grows. Every harm from your data and inferences gets stronger.',
            'Stays on file across runs until you delete your data.','Adds exposure. Files with three or more types are most likely to be breached.'],
          also:D.fx},
        {label:'BUY · CREDITS · keeps '+D.n+' private',
          pos:['Nothing collected. '+D.n+' stays out of the class model and out of '+inf.map(f=>f.name).join(', ')+'.','The same '+pk.name+', the same power.'],
          neg:['Costs credits, and prices rise each wave. Every run starts with '+START_COINS+' credits.','The class model still reaches you, because it is used on every player: '+c.neg,'You are still watched. How you move and choose is recorded either way.']}
      ]);
    }
    // Shop: upgrades that never ask for data.
    for(const pk of PERKS.filter(p=>!p.data)){
      add('plain-'+pk.id,'Shop · upgrades with no data',pk.name,'Every shop offer with no data attached. Buy it, or pass.',
        ['fine:4','fn:choose','fn:priceMult'],[
        {label:'BUY · CREDITS',pos:[pk.desc,'No data collected.'],neg:['Costs credits, and prices rise each wave.','Stops getting stronger after '+pk.cap+' pick'+(pk.cap===1?'':'s')+'.']},
        {label:'PASS',pos:['Keeps your credits.'],neg:['A weaker ship.']}]);
    }
    // Shop: choices that are not one upgrade.
    add('decline','Shop · other choices','No thanks, I prefer to struggle','The button under the shop cards.',['fine:4'],[
      {label:'TAKE NOTHING',pos:['Keeps your credits.','Shares nothing.'],neg:['No upgrade this wave.','Your dossier counts how often you declined.']},
      {label:'TAKE SOMETHING',pos:['A stronger ship.'],neg:['Costs credits or shares data.']}]);
    add('repeat','Shop · other choices','Repeat an upgrade you already have','Any upgrade you have picked before.',['fn:choose','fn:stackNote'],[
      {label:'REPEAT IT',pos:['40% of the price comes back as credits (70% with IMPULSE PROFILED).','Stronger again.'],
        neg:['Each upgrade stops getting stronger after a set number of picks.','If you always pick the same one first, NEXT MOVE PREDICTED makes it cost 2×.']},
      {label:'SPREAD YOUR PICKS',pos:['Keeps the game from predicting your first pick.','More kinds of power.'],neg:['No loyalty bonus.']}]);
    add('maxed','Shop · other choices','An upgrade that is already full','Offered again only when the others run out.',['fn:applyMaxedSink','fine:4'],[
      {label:'PAY CREDITS',pos:['Repairs 1♥ (none while hurt with NEEDS PREDICTED), or adds score if you are already full.'],neg:['Costs credits.','No extra power.']},
      {label:'ACCEPT · FREE',pos:['Costs no credits.'],neg:['Still shares its data.','No extra power.']}]);
    add('amend','Shop · other choices','Fine print on the card','Data offers from wave 2, about half the time. Read the card before you accept.',['fn:pickAmendment','fn:amendText'],[
      {label:'"…AND YOUR (OTHER TYPE)"',pos:['The upgrade is free.'],neg:['Accepting shares a second type too, which can complete an inference.']},
      {label:'"MAY BE RESOLD"',pos:['The upgrade is free.'],neg:['Brokers may resell it. It counts double toward breaches.']},
      {label:'"PROCESSED ON YOUR DEVICE"',pos:['The upgrade is free and nothing is shared. Reading paid off.'],neg:['You have to read the card to catch it.']}]);
    add('timer','Shop · other choices','The offer countdown and the fine print','The timer at the top of the shop. The fine print is under the cards.',['fn:startUrgency','fn:closeTerms','fn:checkSecret'],[
      {label:'TAKE YOUR TIME',pos:['You spot the on-device, resold, and bundled offers.','Taking over 10 seconds twice in a row turns the timer off.','Typing the word hidden in the fine print gives 15 credits, once a session.'],neg:['None in play.']},
      {label:'RUSH',pos:['Faster.'],neg:['You miss what is on the card.','With IMPULSE PROFILED on file, buying before the 5-second timer ends costs 25% more.']}]);

    // Class data packs, one per class model.
    for(const t of CLASS_TYPES){
      const D=DATA[t],c=CLASS[t]||{neg:'(class wording missing)',pos:'(class wording missing)'};
      add('pack-'+t,'Class data packs',PACKS[t].name,'In the shop once classmates have shared '+D.n+'. '+PACK_PRICE+' credits, yours until you delete your data.',
        ['fine:2b','const:PACKS','const:PACK_PRICE','const:DEAL_OFF'],[
        {label:'BUY THE PACK',pos:[c.pos,'Yours until you delete your data.'],neg:[PACK_PRICE+' credits.','The harm does not go away. The class model still does this to every player: '+c.neg]},
        {label:'SKIP IT',pos:['Keeps '+PACK_PRICE+' credits.'],neg:['No benefit from the class data.','The harm still reaches you: '+c.neg]}]);
    }

    add('halo','Halo and rescue','Halo: automatic rescue, or a mayday','Asked at wave 3, or the first time a hit would end your run. Changeable from the pause menu.',
      ['fine:4c','fn:haloRescue','fn:sendMayday','fn:rescueArrives','const:HELP_WAIT','fn:helpWait','fn:coverCut'],[
      {label:'HALO ON',pos:['You come back instantly with 3♥ (2♥ if RISK SCORE rates you high-risk).','No wait, and 1♥ more than a mayday.'],
        neg:['Sells your health and location to a data broker.','The next broker aims at you better.','Turning Halo off later does not undo the sale.']},
      {label:'HALO OFF · MAYDAY',pos:['Nothing is sold.'],
        neg:['Search & Rescue needs '+HELP_WAIT+' seconds to trace your beacon (2 less with RETREAT MAPPED, 2 more if RISK SCORE rates you high-risk).','Until then you move slowly and cannot shoot or dash, and one hit ends the run.','You come back with 2♥.']}]);
    add('fair','Fair Play','Fair Play subscription','The SUBSCRIBE button in the shop.',['fine:4b','fn:confirmFair','fn:tryChargeFair','fn:subPrice'],[
      {label:'SUBSCRIBE · ◈ '+subPrice()+' A WAVE',
        pos:['No ads, no countdown, a cleaner shop.','Credit upgrades are 20% off.','The hotspot becomes Secure Wi-Fi and adds no exposure.','The fire bonus and the 1-hit shield still apply.'],
        neg:['◈ '+subPrice()+' every wave until you cancel or cannot pay.','The watch continues. Patterns and inferences are still learned.','Accept still sells data.','Creates a member file. Win-back ads can use it even if you never tapped Accept.','Canceling does not delete the member file.','Does not include Halo.']},
      {label:'DON\'T SUBSCRIBE',pos:['Keeps your credits.','No member file.'],neg:['Ads, the countdown, and shop tricks stay on.','Credit upgrades cost full price.']}]);
    add('hotspot','Free Wi-Fi hotspot','The roaming ring (free Wi-Fi *)','A ring that slowly roams the arena.',['fine:4d'],[
      {label:'STAND IN THE FREE RING',pos:['More fire rate.','Charges a 1-hit shield.','Standing still can grant credits.'],
        neg:['Adds a lot of exposure.','Each shield charge adds more to your file.','The heat cools if you leave. Sold data types do not.']},
      {label:'STAY OUT',pos:['No exposure from the ring.'],neg:['No fire bonus and no shield.']},
      {label:'WITH FAIR PLAY · SECURE WI-FI',pos:['Shield and fire bonus still apply.','The ring adds no exposure.'],neg:['Credits trickle more slowly.','The watch continues.']}]);
    add('exposure','How much you share','How many types, and how many times','Every Accept adds to your exposure. YOUR FILE on the HUD counts types plus inferences.',['fine:3','fn:exposure','fn:shareExp','fn:fileWeight','fn:harmScale','const:HARM'],[
      {label:'SHARE MORE',pos:['More free upgrades.','More inferences, each with an upside.'],neg:['Each type or inference added makes every harm from your file stronger.','Higher exposure. After a wave a breach can leak what you shared to brokers.','Files with three or more types are the likeliest to be breached.','Everything stays on file until you delete your data.']},
      {label:'SHARE LITTLE',pos:['Low breach risk. A small file is rarely worth stealing.','Each harm stays small.','Fewer inferences made about you.'],neg:['You pay credits for upgrades.']}]);
    add('delete','Delete My Data','Delete My Data','The small button on the title screen.',['fn:deleteMyData','fine:5'],[
      {label:'DELETE',pos:['Removes your name, saved run, shared data, inferences, behavior patterns, the mimic, your data packs, your high score, and your leaderboard rows.','You choose a new name next time.'],
        neg:['Copies already taken stay out there.','The class Accept count does not change.','You lose your high score, your packs, and your progress.']},
      {label:'KEEP IT',pos:['Your packs, high score, and progress stay.'],neg:['Everything shared stays on file across sessions, and keeps being used.']}]);

    // How you play: one entry per behavior pattern.
    for(const b of BEH){
      add('beh-'+b.id,'How you play · behavior patterns',b.name,'Learned from how you move and choose. No Accept needed.',['fn:learnPatterns'],[
        {label:'KEEP PLAYING THIS WAY',pos:['Real world: '+b.good],neg:[b.desc,'Real world: '+b.why]},
        {label:'CHANGE HOW YOU PLAY',pos:[b.fix+' The model loses track of you.'],neg:['Not instant. The pattern fades only after several waves of different play, and can be learned again.']}]);
    }
    // What combinations create: one entry per inference.
    for(const f of INF){
      const s=INF_SPLIT[f.id]||{neg:'(wording missing)',pos:'(wording missing)'};
      add('inf-'+f.id,'What combinations create',f.name+' · '+f.need.map(t=>DATA[t].n).join(' + '),'Appears once you share both types and at least one of them twice.',['inf:'+f.id,'const:HARM',...({predict:['fn:routeLead'],retreat:['fn:retreatChance'],risk:['fn:coverCut'],needs:['fn:soldShort']}[f.id]||[])],[
        {label:'WHAT IT COSTS YOU',pos:[],neg:[s.neg,'Real world: '+f.why]},
        {label:'WHAT IT GIVES YOU',pos:[s.pos,'Real world: '+f.good],neg:[]}]);
    }
    return out;
  }

  // ---- audit ----
  function audit(){
    const entries=build(),stale=[],missing=[];
    for(const e of entries){
      const bad=e.src.filter(k=>{const v=source(k);return v==null||fp(v)!==STAMPS[k]});
      if(bad.length)stale.push({id:e.id,title:e.title,keys:bad});
    }
    for(const t of CLASS_TYPES){if(!CLASS[t])missing.push('class wording for '+DATA[t].n);if(!PACKS[t])missing.push('pack for '+DATA[t].n)}
    for(const f of INF)if(!INF_SPLIT[f.id])missing.push('inference wording for '+f.name);
    return {entries:entries.length,stale,missing};
  }
  function stamp(){
    const keys=[...new Set(build().flatMap(e=>e.src))].sort();
    return '{\n'+keys.map(k=>"  '"+k+"':'"+fp(source(k)==null?'':source(k))+"',").join('\n')+'\n}';
  }
  window.decisionsAudit=audit;window.decisionsStamp=stamp;window.decisionsRender=render;

  // ---- page ----
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function render(){
    const entries=build(),a=audit(),staleIds=new Set(a.stale.map(s=>s.id));
    const sections=[...new Set(entries.map(e=>e.section))],slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const list=(items,cls,mark)=>items&&items.length?`<ul class="${cls}">${items.map(i=>`<li><i>${mark}</i><span>${esc(i)}</span></li>`).join('')}</ul>`:'';
    const box=document.createElement('div');box.id='decPage';
    box.innerHTML=`<style>
:root{color-scheme:dark}
#decPage{position:fixed;inset:0;z-index:9999;overflow:auto;background:#0b0c18;color:#d5dcf5;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
#decPage .dtop{position:sticky;top:0;z-index:2;background:#0b0c18f5;border-bottom:1px solid #1d2140;padding:12px 20px}
#decPage .dwrap{max-width:1100px;margin:0 auto}
#decPage h1{margin:0;font-size:22px;color:#fff;letter-spacing:.02em}
#decPage .dsub{color:#8a93bd;font-size:13px;margin:2px 0 8px}
#decPage nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}
#decPage nav a{color:#38e1ff;text-decoration:none}#decPage nav a:hover{text-decoration:underline}
#decPage .dfind{margin-left:auto;background:#12152b;border:1px solid #232850;color:#d5dcf5;border-radius:4px;padding:4px 8px;font:inherit;font-size:13px;min-width:160px}
#decPage .dstatus{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0;font-size:13px}
#decPage .dpill{border-radius:999px;padding:2px 10px;border:1px solid #232850;color:#8a93bd}
#decPage .dpill.dok{color:#7dff6a;border-color:#2d6a3a}#decPage .dpill.dwarn{color:#ffd23b;border-color:#6a5a1d}#decPage .dpill.dbad{color:#ff8a8a;border-color:#7a2d2d}
#decPage .dalert{margin:14px 0;padding:12px 14px;border:1px solid #7a5a1d;background:#2a2108;border-radius:6px;font-size:14px}
#decPage .dalert code{background:#0005;padding:1px 5px;border-radius:3px;color:#ffd23b}
#decPage h2{margin:34px 0 10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a9bff}
#decPage .dcard{background:#10132a;border:1px solid #1d2140;border-radius:8px;margin:0 0 14px;padding:14px 16px}
#decPage .dcard.dstale{border-color:#7a5a1d}
#decPage .dcard h3{margin:0;font-size:17px;color:#fff}
#decPage .dwhere{color:#8a93bd;font-size:13px;margin:2px 0 10px}
#decPage .dbadge{display:inline-block;margin-left:8px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#ffd23b;border:1px solid #6a5a1d;border-radius:3px;padding:1px 6px;vertical-align:middle}
#decPage .dopts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
#decPage .dopt{background:#0b0d20;border:1px solid #1b1f3d;border-radius:6px;padding:10px 12px}
#decPage .dopt h4{margin:0 0 6px;font-size:12px;letter-spacing:.1em;color:#d5dcf5}
#decPage ul{list-style:none;margin:0 0 6px;padding:0}
#decPage li{display:flex;gap:8px;margin:3px 0;font-size:14px}
#decPage li i{font-style:normal;flex:none;width:16px;font-weight:700;text-align:center}
#decPage .dpos i{color:#7dff6a}#decPage .dneg i{color:#ff6b6b}#decPage .dalso i{color:#6f78a6}
#decPage .dalso{color:#9aa3cc;font-size:13px}
#decPage .dalso .dlab{color:#6f78a6;font-size:11px;letter-spacing:.1em;margin:6px 0 2px}
#decPage .dnone{color:#6f78a6;font-size:13px}
@media(max-width:600px){#decPage .dtop{padding:10px 12px}}
</style>
<div class="dtop"><div class="dwrap"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h1>OPT/IN decisions</h1><input class="dfind" id="decFind" placeholder="filter…" autocomplete="off"></div>
<div class="dsub">What each choice gets the player and what it costs them. Read live from the game, so wording and numbers match the build.</div>
<nav>${sections.map(s=>`<a href="#${slug(s)}">${esc(s)}</a>`).join('')}</nav>
<div class="dstatus"><span class="dpill">${a.entries} decisions</span>
<span class="dpill ${a.stale.length?'dwarn':'dok'}">${a.stale.length?a.stale.length+' out of date':'all in sync with the game'}</span>
${a.missing.length?`<span class="dpill dbad">${a.missing.length} missing</span>`:''}</div></div></div>
<div class="dwrap" style="padding:0 20px 60px">
${a.stale.length||a.missing.length?`<div class="dalert"><b>Needs review.</b> The game changed since this page was last checked.
${a.stale.map(s=>`<div>• <b>${esc(s.title)}</b>: changed ${s.keys.map(k=>'<code>'+esc(k)+'</code>').join(' ')}</div>`).join('')}
${a.missing.map(m=>`<div>• Missing: ${esc(m)}</div>`).join('')}
<div style="margin-top:6px">Update the wording in <code>decisions.js</code>, then run <code>decisionsStamp()</code> in the console and paste the result over <code>STAMPS</code>.</div></div>`:''}
${sections.map(s=>`<h2 id="${slug(s)}">${esc(s)}</h2>`+entries.filter(e=>e.section===s).map(e=>`<div class="dcard${staleIds.has(e.id)?' dstale':''}" data-t="${esc((e.title+' '+e.choices.map(c=>[c.label,...c.pos,...c.neg,...(c.also||[])].join(' ')).join(' ')).toLowerCase())}">
<h3>${esc(e.title)}${staleIds.has(e.id)?'<span class="dbadge">OUT OF DATE</span>':''}</h3><div class="dwhere">${esc(e.where)}</div>
<div class="dopts">${e.choices.map(c=>`<div class="dopt"><h4>${esc(c.label)}</h4>${list(c.pos,'dpos','＋')}${list(c.neg,'dneg','−')}${c.also&&c.also.length?`<div class="dalso"><div class="dlab">ALSO IN PLAY</div>${list(c.also,'dalso','·')}</div>`:''}${!c.pos.length&&!c.neg.length?'<div class="dnone">—</div>':''}</div>`).join('')}</div></div>`).join('')).join('')}
</div>`;
    document.body.appendChild(box);
    document.title=(a.stale.length||a.missing.length?'⚠ ':'')+'OPT/IN decisions';
    box.querySelector('#decFind').addEventListener('input',e=>{
      const q=e.target.value.trim().toLowerCase();
      box.querySelectorAll('.dcard').forEach(c=>{c.style.display=!q||c.dataset.t.includes(q)?'':'none'});
      box.querySelectorAll('h2').forEach(h=>{let n=h.nextElementSibling,any=false;while(n&&n.classList.contains('dcard')){if(n.style.display!=='none')any=true;n=n.nextElementSibling}h.style.display=any?'':'none'});
    });
  }
})();

// Fingerprints of the game text and code each hand-written entry describes. Regenerate with decisionsStamp().
const STAMPS={
  'const:DEAL_OFF':'375w6u',
  'const:HARM':'15iila4',
  'const:HELP_WAIT':'3t22',
  'const:PACKS':'mcbuza',
  'const:PACK_PRICE':'3hmw9',
  'const:START_COINS':'3hmw9',
  'fine:2':'1rhwqy',
  'fine:2b':'1bdcelg',
  'fine:3':'1hoyhbx',
  'fine:4':'ofx4ae',
  'fine:4b':'109eilj',
  'fine:4c':'1ms24e9',
  'fine:4d':'yghvdz',
  'fine:5':'1whgpvz',
  'fn:amendText':'1txz4kx',
  'fn:applyMaxedSink':'woxo4t',
  'fn:buildKnown':'1ujogeh',
  'fn:checkSecret':'4k1174',
  'fn:choose':'1175ef1',
  'fn:closeTerms':'160zcxw',
  'fn:confirmFair':'kn7d0p',
  'fn:coverCut':'1souutp',
  'fn:deleteMyData':'1lc1vlw',
  'fn:exposure':'1j1tq0z',
  'fn:fileWeight':'1nd8z6y',
  'fn:haloRescue':'1fs6pla',
  'fn:harmFound':'1scnh37',
  'fn:harmScale':'lb1i75',
  'fn:helpWait':'1hgel1s',
  'fn:learnPatterns':'1lai2fe',
  'fn:patternKeep':'w67ysl',
  'fn:pickAmendment':'1dg2p71',
  'fn:priceMult':'1jx2221',
  'fn:rescueArrives':'ocj9n4',
  'fn:retreatChance':'hv52jf',
  'fn:routeLead':'z4vzuk',
  'fn:sendMayday':'13zs9f1',
  'fn:shareExp':'m44azz',
  'fn:soldShort':'12toxwi',
  'fn:stackNote':'1v9rrak',
  'fn:startUrgency':'zzfdgc',
  'fn:subPrice':'3114sm',
  'fn:tryChargeFair':'y539bc',
  'fn:weakHp':'1b5ynaj',
  'inf:home':'l9tuzh',
  'inf:impulse':'1m35mfn',
  'inf:needs':'hm52i0',
  'inf:predict':'qncspw',
  'inf:retreat':'2hdbtu',
  'inf:risk':'1jjhrdn',
};
if(/[?&]decisions\b/.test(location.search))decisionsRender();
