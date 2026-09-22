const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function harness(version='V1_31_0') {
 const all=[],ids=new Map(),data=new Map();
 function matches(el,sel) {
   sel=sel.trim(); if(!sel)return false;
   if(sel.includes(','))return sel.split(',').some(s=>matches(el,s));
   if(sel.includes(' ')){const parts=sel.split(/\s+/),last=parts.pop();if(!matches(el,last))return false;let p=el.parentElement;while(p){if(matches(p,parts.join(' ')))return true;p=p.parentElement;}return false;}
   if(sel.includes(':checked')&&!el.checked)return false;
   sel=sel.replace(':checked','');
   const tag=/^[a-zA-Z][\w-]*/.exec(sel);if(tag&&el.tagName!==tag[0].toUpperCase())return false;
   for(const m of sel.matchAll(/#([\w-]+)/g))if(el.id!==m[1])return false;
   for(const m of sel.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(m[1]))return false;
   for(const m of sel.matchAll(/\[([^\]=]+)(?:=["']?([^"'\]]+)["']?)?\]/g)){const v=m[1]==='value'?el.value:el.attrs[m[1]];if(v===undefined||m[2]!==undefined&&v!==m[2])return false;}
   return true;
 }
 class Element{
  constructor(tag,attrs={},text=''){
   this.tagName=tag.toUpperCase();this.attrs={...attrs};this.id=attrs.id||'';this.type=attrs.type||'';this.name=attrs.name||'';this.children=[];this.parentElement=null;this.checked='checked'in attrs;this.disabled='disabled'in attrs;this.hidden='hidden'in attrs;this._value=attrs.value||'';this._text=text;this._html='';this.dataset={};this.style={};this.files=[];this.listeners={};
   const classes=new Set((attrs.class||'').split(/\s+/).filter(Boolean));this.classList={add:(...vs)=>vs.forEach(v=>classes.add(v)),remove:(...vs)=>vs.forEach(v=>classes.delete(v)),contains:v=>classes.has(v),toggle:(v,b)=>{b=b??!classes.has(v);b?classes.add(v):classes.delete(v);return b;}};
   for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;
  }
  get selectedOptions(){return this.options.filter(o=>o.value===this.value);}
  get options(){return this.children.filter(c=>c.tagName==='OPTION');}
  get value(){if(this.tagName==='SELECT'&&!this._explicit)return(this.options.find(c=>c.selected||'selected'in c.attrs)||this.options[0])?.value||'';return this._value;}
  set value(v){this._value=String(v);this._explicit=true;}
  get textContent(){return this._text;} set textContent(v){this._text=String(v??'');}
  get innerHTML(){return this._html;} set innerHTML(v){this._html=String(v);if(this.tagName==='SELECT'){this.children=[];this._explicit=false;for(const m of String(v).matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/g)){const attrs={};for(const a of m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';this.appendChild(new Element('option',attrs,m[2]));}}}
  add(el){return this.appendChild(el);}
  appendChild(el){el.parentElement=this;this.children.push(el);return el;} append(...els){els.forEach(e=>this.appendChild(e));}
  querySelectorAll(sel){const result=[];function visit(node){for(const c of node.children){if(matches(c,sel))result.push(c);visit(c);}}visit(this);return result;}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);} removeEventListener(){} setAttribute(k,v){this.attrs[k]=String(v);} removeAttribute(k){delete this.attrs[k];} getAttribute(k){return this.attrs[k]??null;}
  focus(){} scrollIntoView(){} setCustomValidity(){} showModal(){this.open=true;} close(){this.open=false;} click(){} remove(){} getBoundingClientRect(){return {top:0,bottom:0,width:100,height:30};}
 }
 const nodes=JSON.parse(fs.readFileSync(path.join(__dirname,'dom-fixture.json')));
 for(const node of nodes){const el=new Element(node.tag,node.attrs,node.text);all.push(el);if(el.id)ids.set(el.id,el);if(node.parent!==null)all[node.parent].appendChild(el);}
 const doc={getElementById:id=>ids.get(id)||null,querySelectorAll:s=>all.filter(el=>matches(el,s)),querySelector:s=>all.find(el=>matches(el,s))||null,createElement:tag=>new Element(tag),body:all.find(el=>el.tagName==='BODY'),addEventListener:()=>{}};
 const ctx={document:doc,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},console,crypto,Blob,File,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,Date,Intl,Math,Number,JSON,Set,Map,Object,Array,String,Boolean,Promise,RegExp,Error,setTimeout:()=>0,clearTimeout:()=>{},navigator:{},confirm:()=>true};
 ctx.Option=function(text,value){return new Element('option',{value},text);};ctx.window=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};ctx.matchMedia=()=>({matches:false});
 vm.createContext(ctx);
 if(version==='V1_31_0') vm.runInContext(fs.readFileSync(ROOT+'/dual-track-engine.js','utf8'),ctx);
 let script=fs.readFileSync(ROOT+'/app.js','utf8');
 const names=['recalculate','recalculateLiveDecision','evaluateBaseTrigger','evaluateAsia2B','evaluateDecision','computeMarketRoute','matrixCell','applyRangePosition','applyObstacle','evaluateHardVeto','buildCsv','csvRowsToObjects','recordFromCsvRow','buildStoredZip','readStoredZipEntries','mergeEditedCsvOverBackupJson','loadRecords','saveRecords','saveDecision','openRecord','saveRecordEdit','renderHistory','applyMarketPreset','applySetupTemplate','populateSetupTemplateSelect'];
 if(version==='V1_31_0')names.push('freezeDualEntry','updateDualTrack','validateDualSave','attachDualRecord','dualEntryPayload','readV14Outcome','candidateInputs','renderDualStats');
 script=script.replace('initialize();\n})();',`getImages=async()=>[];putImages=async()=>{};deleteImages=async()=>{};window.testApi={${names.join(',')}, get decision(){return currentDecision;},get setup(){return currentAsia2B;},get trigger(){return currentBaseTrigger;}${version==='V1_31_0'?',get candidate(){return currentCandidate;},get frozen(){return frozenDualTrack;},clearFreeze(){frozenDualTrack=null;}':''}};\ninitialize();\n})();`);
 vm.runInContext(script,ctx,{timeout:10000});
 return {ctx,api:ctx.testApi,ids,data,set:(id,v)=>{const e=ids.get(id);assert(e,'Missing '+id);if(e.type==='checkbox')e.checked=v;else e.value=v;},direction:v=>{doc.querySelectorAll('input[name="direction"]').forEach(e=>e.checked=e.value===v);}};
}
async function main(){
 const h=harness(),a=h.api;console.log('PASS initialize: 522 HTML IDs and both calculator views run.');
 function fixture(main='健康升勢',secondary='健康升勢',p='P2',reclaim='strong'){
  h.set('marketCode','FX');a.populateSetupTemplateSelect('FX','setupTemplate','fx_liquidity_sweep');a.applySetupTemplate(false);h.direction('Long');
  for(const [id,v]of Object.entries({mainState:main,secondaryState:secondary,positionLevel:p,validSweep:true,validReclaim:true,microStructureShift:true,reclaimQuality:reclaim,retestQuality:'weak',tradeSpace:'sufficient',hasFirstObstacle:false,insideMajorObstacle:false,q2FastRetest:false,q2StrongRetest:false,q2DeepRetest:false,sharedESource:'auto',sharedEFirst:false,sharedEFresh:false,v14Boundary:false,retestInternalStructure:'',retestAcceptance:'',p3Context:'PB'}))h.set(id,v);
  a.recalculate();
 }
 fixture();console.log('fixture',a.trigger.quality,a.trigger.reclaimQuality,a.trigger.retestQuality,a.decision.finalSize,a.candidate.size);
 assert.equal(a.decision.finalSize,1);assert.equal(a.candidate.size,1);
 fixture('轉換中－偏升','轉換中－偏跌');assert.equal(a.decision.finalSize,.25);assert.equal(a.candidate.size,.5);
 const baseline=JSON.stringify(a.decision);
 h.set('v14ControlNegated',true);a.recalculate();assert.equal(a.candidate.size,0);assert.equal(JSON.stringify(a.decision),baseline,'Candidate input must not affect Production');h.set('v14ControlNegated',false);
 fixture();h.set('q2StrongRetest',true);h.set('reclaimQuality','ordinary');h.set('retestInternalStructure','structured');a.recalculate();assert.equal(a.trigger.quality,'Q2');assert.equal(a.decision.finalSize,.5);assert.equal(a.candidate.size,.25);
 // Shared Mon E and explicit all-market sources, production .25 Q2 cap untouched.
 for(const source of ['monHL','pdhPdl','oprHL','htfMajor']){
  fixture('健康升勢','健康升勢','P3');h.set('sharedESource',source);h.set('sharedEFirst',true);h.set('sharedEFresh',true);h.set('sharedEActive',true);a.recalculate();
  assert.equal(a.setup.effectivePosition,'P2',source);assert.equal(a.decision.finalSize,1,source);assert.equal(a.candidate.size,.5,source);
 }
 console.log('PASS integration: key sizing cases, shared E, Candidate isolation.');
 fixture('轉換中－偏升','轉換中－偏跌');
 h.set('symbol','TEST-EURUSD');h.set('tradeDate','2026-01-08');h.set('v14Entry',100);h.set('v14SL',99);h.set('v14EntryTime','2026-01-08T09:30');h.set('entryStatus','Entry');
 a.freezeDualEntry();assert(a.frozen);const snap=JSON.stringify(a.frozen);
 h.set('v14Entry',101);a.recalculate();assert.equal(a.validateDualSave(),false,'Stale entry snapshot blocked');assert.equal(JSON.stringify(a.frozen),snap);h.set('v14Entry',100);a.recalculate();
 h.set('profitR',.5);h.set('mfeR',4);h.set('v14ShadowTrade','Yes');h.set('v14Reached2R','Yes');h.set('v14GateRecorded','Yes');for(const name of ['Break','Acceptance','Hold','Extend'])h.set('v14Gate'+name,true);h.set('v14RunnerExitR',4);a.recalculate();
 assert.equal(h.ids.get('validCandidate').value,'Yes');assert.equal(h.ids.get('reachedTP2').value,'Yes');assert.equal(JSON.stringify(a.frozen),snap);assert.equal(a.validateDualSave(),true);
 await a.saveDecision({preventDefault(){}});const records=a.loadRecords();assert.equal(records.length,1);const r=records[0];assert.equal(r.v14FullR,1.2);assert.equal(r.v13ActualR,.5);assert.equal(r.v14RunnerOnlyR,.6);
 const csv=a.buildCsv(records);const decoded=a.csvRowsToObjects(csv).map(a.recordFromCsvRow);assert.equal(decoded[0].dualTrackSnapshot.fingerprint,r.dualTrackSnapshot.fingerprint);assert.equal(decoded[0].v14FullR,1.2);assert.equal(decoded[0].v13ActualR,.5);
 const zip=await a.buildStoredZip([{name:'records.json',data:JSON.stringify(records)},{name:'trades.csv',data:csv},{name:'images/test/image-1.png',data:new Uint8Array([137,80,78,71])}]);
 const entries=await a.readStoredZipEntries(zip);assert.equal(entries.size,3);assert.equal(entries.get('images/test/image-1.png')[0],137);
 const edited=a.csvRowsToObjects(csv)[0];edited['V1.4 Outcome runnerExitR']='0';const keys=Object.keys(edited);const esc=x=>'\"'+String(x).replaceAll('\"','\"\"')+'\"';const editedCSV=[keys.map(esc).join(','),keys.map(k=>esc(edited[k])).join(',')].join('\n');
 const merged=a.mergeEditedCsvOverBackupJson(records,editedCSV);assert.equal(merged.records[0].v14FullR,.8);assert.equal(merged.records[0].finalSize,.25);assert.equal(merged.records[0].dualTrackSnapshot.fingerprint,r.dualTrackSnapshot.fingerprint);
 console.log('PASS save + CSV + ZIP, edited outcomes retain frozen entry and Production.');
 await a.openRecord(r.id);h.set('editMfeR',3.9);h.set('editv14RunnerExitR',0);await a.saveRecordEdit();
 const review=a.loadRecords()[0];assert.equal(review.reachedTP2,'No');assert.equal(review.validCandidate,'Yes');assert.equal(review.v14FullR,.8);assert.equal(review.finalSize,.25);assert.equal(review.dualTrackSnapshot.fingerprint,r.dualTrackSnapshot.fingerprint);
 assert.equal(review.v13ActualR,.5);console.log('PASS edit outcome: frozen size/entry untouched, MFE auto threshold respected.');
 // Live calculator uses the same independent Candidate engine.
 for(const [id,v]of Object.entries({liveMarketCode:'FX',liveMarketRoute:'mixedTransition',livePosition:'P2',liveTriggerQuality:'Q3',liveHasFirstObstacle:false,liveRangePosition:'favorable'}))h.set(id,v);
 a.recalculateLiveDecision();assert.equal(h.ids.get('liveV13Size').textContent,'0.25注');assert.equal(h.ids.get('liveV14Size').textContent,'0.5注');
 h.set('livev14CounterMain',true);a.recalculateLiveDecision();assert.equal(h.ids.get('liveV14Size').textContent,'0注｜不做');assert.equal(h.ids.get('liveV13Size').textContent,'0.25注');
 console.log('PASS Live: same route sizing and Candidate permission isolation.');
 // New-only path has a real snapshot, never a production performance entry.
 a.clearFreeze();fixture('轉換中－偏升','轉換中－偏跌','P2','ordinary');h.set('v14Boundary',true);a.recalculate();assert.equal(a.decision.finalSize,0);assert.equal(a.candidate.size,.25);
 for(const [id,v]of Object.entries({symbol:'TEST-ONLY',v14Entry:100,v14SL:99,v14EntryTime:'2026-01-08T10:00',entryStatus:'Skip'}))h.set(id,v);
 a.freezeDualEntry();h.set('v14ShadowTrade','Yes');h.set('v14ManagementUnitR',-1);h.set('v14BaseUnitR',-1);a.recalculate();await a.saveDecision({preventDefault(){}});
 const only=a.loadRecords()[0];assert.equal(only.v14CandidateOnly,'Yes');assert.equal(only.productionEntry,'No');assert.equal(only.v14ShadowR,-.25);assert.equal(only.v13ActualR,null);assert.equal(h.ids.get('statAverageR').textContent,'0.50');
 console.log('PASS V1.4-only is excluded from Production stats.');
 // Test frozen V1.3 engine functions remain byte-identical (except explicitly shared E).
 const hashes=JSON.parse(fs.readFileSync(path.join(__dirname,'v13-baseline-hashes.json'))),newer=fs.readFileSync(ROOT+'/app.js','utf8');
 const functionText=(src,name)=>{let a=src.indexOf('function '+name+'('),b=src.indexOf('\nfunction ',a+1);return src.slice(a,b<0?undefined:b);};
 for(const name of ['computeMarketRoute','matrixCell','evaluateMatrix','applyRangePosition','applyObstacle','evaluateHardVeto','tradeObjectiveInfo','evaluateDecision'])assert.equal(crypto.createHash('sha256').update(functionText(newer,name)).digest('hex'),hashes[name],name);
 console.log('PASS 8 V1.3 decision/risk/objective functions are byte-identical.');

}
main().catch(e=>{console.error(e);process.exitCode=1;});
