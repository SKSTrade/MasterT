(() => {
"use strict";
const STORAGE_KEY="masterTradeV34Records";
const $=id=>document.getElementById(id);
const checked=id=>$(id).checked;
const direction=()=>document.querySelector('input[name="direction"]:checked').value;

const STATES={
"健康升勢":{bias:"up",healthy:true,note:"HH／HL清楚；主結未被破壞；推動有延續；回調正常；突破高位後有 follow-through。"},
"弱升勢":{bias:"up",healthy:false,note:"升勢仍存在，但回調較深、延續轉差或次結受破壞。仍偏 Long，但唔可追高。"},
"轉換中":{bias:null,healthy:false,note:"原趨勢已被破壞，新趨勢未確認。只做重要位置；中間位不做。"},
"弱跌勢":{bias:"down",healthy:false,note:"跌勢仍存在，但下跌質素下降。仍偏 Short，但唔可在低位追空。"},
"健康跌勢":{bias:"down",healthy:true,note:"LH／LL清楚；主結未被破壞；跌段有延續；回調正常；破低後有 follow-through。"}
};

const TF={
"1M":{background:"4H",main:"1H",secondary:"15M"},
"3M":{background:"4H",main:"1H",secondary:"15M"},
"5M":{background:"D",main:"4H",secondary:"1H"},
"15M":{background:"D",main:"4H",secondary:"1H"},
"1H":{background:"W",main:"D",secondary:"4H"}
};

const POS={
P1:{title:"重大 HTF 位置、主判斷層主結或大型區間邊界",note:"包括週／日線重大支持阻力、主判斷層主結、大型區間邊界、會改變主判斷層狀態嘅突破回測、次判斷層主結同更高級別大位重疊，以及 W618／D618 同實際 HTF 結構重疊。P1 唔代表自動入場。"},
P2:{title:"次判斷層主結、主判斷層次結及重要工作區",note:"包括普通次判斷層主結、主判斷層次結、重要區間邊界、突破接受後首次回測、impulse origin／swap zone，以及主結同 Asia High/Low、OPR、PDH/PDL 重疊。"},
P3:{title:"次判斷層次結、低一級主結及普通局部匯合",note:"包括次判斷層次結、低一級主結、session high/low＋普通局部結構、0.618＋普通 swap，以及純低時間框架區間邊界。只適合健康同向順勢，或者 0.25 注測試。"},
P4:{title:"中間位、純 Fib、純 Session 位或前方空間不足",note:"包括橫行中間、純 Fib、純 Asia High/Low、純 OPR、純 2B 而冇 HTF 結構、前方阻力／支持太近，或距離上下兩邊差唔多。無論 Trigger 幾靚都係 0 注。"}
};

const SIZE={0:"0注｜不做",0.25:"0.25注",0.5:"0.5注",1:"1注"};
let triggerResult,decisionResult,activeRecordId;

function tf(){return TF[$("entryTimeframe").value]}
function relation(main,secondary){
 if(STATES[main].bias===null||STATES[secondary].bias===null)return "包含轉換";
 if(STATES[main].bias===STATES[secondary].bias)return STATES[main].healthy&&STATES[secondary].healthy?"健康同向":"弱勢同向";
 return "方向衝突";
}
function bgRelation(){
 const s=STATES[$("backgroundState").value],b=direction()==="Long"?"up":"down";
 return s.bias===null?"大局背景轉換中":s.bias===b?"順大局背景":"逆大局背景";
}
function cap(r){return r==="健康同向"?1:0.5}
function count(ids){return ids.filter(checked).length}

function evaluateTrigger(){
 const failures=[],imperfections=[],positives=[];
 const momentum=count(["momentumStrongBody","momentumCloseNearExtreme","momentumBrokeMicroSwing","momentumRVOL","momentumCleanerThanPriorMove"]);
 let retest=0;
 if(checked("retestSlower"))retest++;
 if(checked("retestWeakerCandles"))retest++;
 if($("retestDepth").value==="normal")retest++;
 if(checked("retestLowerVolume"))retest++;

 if(!checked("meaningfulSweep"))failures.push("冇掃走有意義流動性");else positives.push("有效 Sweep");
 if(!checked("reclaimedSweepLevel"))failures.push("未收復 Sweep 位置");
 if(!checked("brokeSweepMicroStructure"))failures.push("未破壞造成 Sweep 嗰段微結構");
 if(checked("reclaimedSweepLevel")&&checked("brokeSweepMicroStructure"))positives.push("有效 Reclaim");

 const follow=$("followThrough").value;
 if(follow==="strong")positives.push("Reclaim 後有明顯 Follow-through");
 if(follow==="ordinary")imperfections.push("Follow-through 一般");
 if(follow==="none")failures.push("Reclaim 後完全冇 Follow-through");

 if(momentum<2)failures.push("Reclaim 動能五項中少過兩項合格");else positives.push(`Reclaim 動能符合 ${momentum} 項`);

 const depth=$("retestDepth").value;
 if(!checked("retestSlower")&&!checked("retestWeakerCandles")&&depth!=="normal")failures.push("Retest 同時快、深，而且反向力度未減");
 if(depth==="invalid"&&!checked("secondConfirmationAfterDeepRetest"))failures.push("Retest 深過 0.88，但冇重新 Reclaim 及第二次確認");
 else if(depth==="invalid")imperfections.push("首次 Retest 深過 0.88，只靠第二次確認保留");
 else if(depth==="imperfect")imperfections.push("Retest 深度 0.786–0.88");

 if(!checked("retestSlower"))imperfections.push("Retest 速度未明顯慢過 Reclaim");
 if(!checked("retestWeakerCandles"))imperfections.push("Retest 單燭力度未明顯減弱");
 if(!checked("retestLowerVolume"))imperfections.push("Retest 成交量未低過 Reclaim");
 if(retest<2&&!(depth==="invalid"&&checked("secondConfirmationAfterDeepRetest")))failures.push("Retest 四項中少過兩項合格");

 const space=$("tradeSpace").value;
 if(space==="enough")positives.push("到第一真實目標有合理空間");
 if(space==="slightlyShort")imperfections.push("前方交易空間略短");
 if(space==="insufficient")failures.push("第一真實目標前不足合理 R:R");
 if(checked("onlyEntryLayerConfirmation"))imperfections.push("只得入場觸發層確認，未有更高級別配合");
 if(!checked("recoveredImpulseOrigin"))imperfections.push("未收復 pause candle／impulse origin");

 let quality="Q1";
 if(!failures.length){
   const q3=follow==="strong"&&momentum>=2&&retest>=3&&depth==="normal"&&space==="enough"&&!checked("onlyEntryLayerConfirmation");
   quality=q3?"Q3":"Q2";
 }
 return{quality,failures,imperfections,positives,momentum,retest};
}

function healthyMatrix(p,q){
 if(["P1","P2"].includes(p)&&q==="Q3")return 1;
 if((["P1","P2"].includes(p)&&q==="Q2")||(p==="P3"&&q==="Q3"))return .5;
 if(p==="P3"&&q==="Q2")return .25;return 0;
}
function weakMatrix(p,q){
 if(["P1","P2"].includes(p)&&q==="Q3")return .5;
 if((["P1","P2"].includes(p)&&q==="Q2")||(p==="P3"&&q==="Q3"))return .25;return 0;
}
function conflictMain(p,q){return weakMatrix(p,q)}
function conflictSecondary(p,q){
 if(p==="P1"&&q==="Q3")return .5;
 if((p==="P1"&&q==="Q2")||(p==="P2"&&q==="Q3"))return .25;return 0;
}
function transitionMain(p,q){return weakMatrix(p,q)}
function transitionAgainst(p,q){if(p==="P1"&&q==="Q3")return .5;if(p==="P1"&&q==="Q2")return .25;return 0}
function trendWithTransition(p,q){if(["P1","P2"].includes(p)&&q==="Q3")return .5;if(["P1","P2"].includes(p)&&q==="Q2")return .25;return 0}
function bothTransition(p,q){
 if(p==="P1"&&q==="Q3")return .5;
 if((p==="P1"&&q==="Q2")||(p==="P2"&&q==="Q3")||(p==="P3"&&q==="Q3"))return .25;return 0;
}
function counterMatrix(p,q){return transitionAgainst(p,q)}

function evaluateDecision(t){
 const bg=$("backgroundState").value,main=$("mainState").value,secondary=$("secondaryState").value;
 const dirBias=direction()==="Long"?"up":"down",p=$("positionLevel").value;
 const r=relation(main,secondary),bgr=bgRelation(),marketCap=cap(r);
 const reasons=[],warnings=[],hard=[];
 if(p==="P4")hard.push("P4 無交易位置");
 if(t.quality==="Q1")hard.push("Trigger 屬 Q1");
 [["chasedBreakout","突破線後立即追價"],["after1030","超過 10:30 入場限制"],["usdRiskExceeded","同一美元方向總風險超標"],["loosenedTriggerBecauseBias","因方向偏升／跌而放寬 Trigger"],["emotionalSizing","因連贏、連輸或特別有信心而加注"]].forEach(([id,msg])=>{if(checked(id))hard.push(msg)});
 if(hard.length)return{relation:r,backgroundRelation:bgr,marketCap,matrixSize:0,adjustedSize:0,finalSize:0,reasons:["硬性否決條件成立，矩陣停止計算。"],warnings:[],hard};

 const withMain=STATES[main].bias===dirBias,withSecondary=STATES[secondary].bias===dirBias;
 let matrix=0;
 if(r==="健康同向"){
   reasons.push("主判斷層與次判斷層健康同向，市場最高注碼為 1 注。");
   if(withMain){matrix=healthyMatrix(p,t.quality);reasons.push("交易方向順主判斷及次判斷共同健康趨勢。")}
   else{matrix=counterMatrix(p,t.quality);warnings.push("交易逆健康同向趨勢，只限 P1 重大邊界。")}
 }else if(r==="弱勢同向"){
   reasons.push("主判斷層與次判斷層方向一致，但未達雙健康。");warnings.push("只要未達雙健康同向，市場最高固定 0.5 注。");
   if(withMain)matrix=weakMatrix(p,t.quality);else{matrix=counterMatrix(p,t.quality);warnings.push("反方向只可在 P1 重大位置捕反轉。")}
 }else if(r==="方向衝突"){
   reasons.push("主判斷層與次判斷層方向相反，市場最高注碼為 0.5 注。");
   if(withMain){matrix=conflictMain(p,t.quality);reasons.push("交易順主判斷，等待次判斷喺 HTF 位置重新轉向。")}
   else if(withSecondary){matrix=conflictSecondary(p,t.quality);warnings.push("交易逆主判斷、順次判斷，只當反彈／回調 Trade。")}
   else warnings.push("交易方向未能由主判斷或次判斷提供支持。");
 }else{
   reasons.push("主判斷或次判斷包含轉換，市場最高注碼為 0.5 注。");
   if(main==="轉換中"&&secondary!=="轉換中"){
     if(withSecondary){matrix=transitionMain(p,t.quality);reasons.push("主判斷轉換，順次判斷局部趨勢。")}
     else{matrix=transitionAgainst(p,t.quality);warnings.push("逆次判斷只准在 P1 另一邊界。")}
   }else if(main!=="轉換中"&&secondary==="轉換中"){
     if(withMain){matrix=trendWithTransition(p,t.quality);warnings.push("次判斷未準備好，必須係 HTF 大位完整 Trigger。")}
     else{matrix=counterMatrix(p,t.quality);warnings.push("逆主判斷只准 P1 重大位置。")}
   }else if($("transitionTag").value!=="已形成橫行"||!checked("isClearRangeBoundary"))warnings.push("主判斷及次判斷都轉換時，只做已形成橫行嘅清晰邊界。");
   else{matrix=bothTransition(p,t.quality);reasons.push("已形成橫行，位置確認為清晰區間邊界。")}
 }

 let adjusted=Math.min(marketCap,matrix);
 if(bgr==="順大局背景")warnings.push("交易順大局背景，但背景層不能將注碼提高。");
 else if(bgr==="大局背景轉換中")warnings.push("大局背景處於轉換，只作環境提醒，不能提供加注理由。");
 else if(STATES[bg].healthy&&checked("atBackgroundSupportResistance")){
   adjusted=Math.min(adjusted,.5);reasons.push("逆健康大局背景，而且已到大局支持／阻力位，最高注碼封頂 0.5 注。");
 }else if(STATES[bg].healthy)warnings.push("逆健康大局背景，但未到大局支持／阻力位：背景層不調整矩陣注碼。");
 else warnings.push("逆弱勢大局背景：背景層不自動調整注碼。");

 if(t.quality==="Q2")warnings.push("Q2 只能減注，不能維持最高注碼。");
 reasons.push(adjusted===0?"市場關係、位置、Trigger 或背景限制令交易變成 0 注。":"最終注碼由主判斷 × 次判斷矩陣計算，再接受大局背景向下限制。");
 return{relation:r,backgroundRelation:bgr,marketCap,matrixSize:matrix,adjustedSize:adjusted,finalSize:adjusted,reasons,warnings,hard};
}

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function listBlock(title,items,cls){return items.length?`<div class="evaluation-block ${cls}"><h3>${esc(title)}</h3><ul>${items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
function renderTrigger(t){
 $("momentumCount").textContent=`${t.momentum}／5`;$("retestCount").textContent=`${t.retest}／4`;
 const g=$("triggerGrade");g.textContent=t.quality==="Q3"?"Q3｜高質":t.quality==="Q2"?"Q2｜合格但有瑕疵":"Q1｜不合格";g.className=`grade ${t.quality.toLowerCase()}`;
 $("triggerEvaluation").innerHTML=listBlock("不合格原因",t.failures,"failures")+listBlock("瑕疵／降級因素",t.imperfections,"imperfections")+listBlock("已確認條件",t.positives,"positives");
}
function renderDecision(d,t){
 const c=tf(),e=$("entryTimeframe").value;
 $("marketRelation").textContent=d.relation;$("marketCap").textContent=SIZE[d.marketCap];$("backgroundRelation").textContent=d.backgroundRelation;
 $("backgroundRelationNote").textContent=d.backgroundRelation==="順大局背景"?"大局同向只作支持，唔會令矩陣注碼升級。":d.backgroundRelation==="逆大局背景"?"大局方向相反。只有指定條件成立時，背景層先會限制最高注碼。":"大局冇明確方向，不會提供加注理由。";
 $("resultBackground").textContent=`${c.background}－${$("backgroundState").value}`;
 $("resultMain").textContent=`${c.main}－${$("mainState").value}`;$("resultSecondary").textContent=`${c.secondary}－${$("secondaryState").value}`;
 $("resultEntry").textContent=`${e}－${t.quality}`;$("resultRelation").textContent=d.relation;$("resultMarketCap").textContent=SIZE[d.marketCap];
 $("resultMatrixSize").textContent=SIZE[d.matrixSize];$("resultAdjustedSize").textContent=SIZE[d.adjustedSize];$("finalSize").textContent=SIZE[d.finalSize];
 $("decisionExplanations").innerHTML=listBlock("計算原因",d.reasons,"decision-block reasons")+listBlock("警告／限制",d.warnings,"decision-block warnings")+listBlock("硬性否決",d.hard,"decision-block denials");
}
function updateUI(){
 const c=tf(),bg=$("backgroundState").value,m=$("mainState").value,s=$("secondaryState").value;
 $("secondaryTimeframeDisplay").textContent=c.secondary;$("mainTimeframeDisplay").textContent=c.main;$("backgroundTimeframeDisplay").textContent=c.background;
 $("entryTimeframeTriggerDisplay").textContent=$("entryTimeframe").value;
 $("backgroundStateLabel").textContent=`大局背景（${c.background}）`;$("mainStateLabel").textContent=`主判斷（${c.main}）`;$("secondaryStateLabel").textContent=`次判斷（${c.secondary}）`;
 $("backgroundStateNote").textContent=STATES[bg].note;$("mainStateNote").textContent=STATES[m].note;$("secondaryStateNote").textContent=STATES[s].note;
 const contains=m==="轉換中"||s==="轉換中",both=m==="轉換中"&&s==="轉換中";
 $("transitionOptions").classList.toggle("hidden",!contains);$("rangeBoundaryRow").classList.toggle("hidden",!both);if(!both)$("isClearRangeBoundary").checked=false;
 const p=POS[$("positionLevel").value];$("positionTitle").textContent=p.title;$("positionNote").textContent=p.note;
 const showBg=bgRelation()==="逆大局背景"&&STATES[bg].healthy;$("backgroundLevelRow").classList.toggle("hidden",!showBg);$("backgroundLevelNote").classList.toggle("hidden",!showBg);if(!showBg)$("atBackgroundSupportResistance").checked=false;
 const deep=$("retestDepth").value==="invalid";$("secondConfirmationRow").classList.toggle("hidden",!deep);if(!deep)$("secondConfirmationAfterDeepRetest").checked=false;
}
function recalc(){updateUI();triggerResult=evaluateTrigger();decisionResult=evaluateDecision(triggerResult);renderTrigger(triggerResult);renderDecision(decisionResult,triggerResult)}

function records(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function store(x){localStorage.setItem(STORAGE_KEY,JSON.stringify(x))}
function yes(v){return v?"是":"否"}
function checklist(){
 const c=tf();return[
 `大局背景：${c.background}－${$("backgroundState").value}`,`主判斷：${c.main}－${$("mainState").value}`,`次判斷：${c.secondary}－${$("secondaryState").value}`,`入場觸發：${$("entryTimeframe").value}`,"",
 `Sweep：${yes(checked("meaningfulSweep"))}`,`收復 Sweep 位置：${yes(checked("reclaimedSweepLevel"))}`,`破微結構：${yes(checked("brokeSweepMicroStructure"))}`,`收復 Impulse Origin：${yes(checked("recoveredImpulseOrigin"))}`,
 `Follow-through：${$("followThrough").selectedOptions[0].textContent}`,`Reclaim 動能：${triggerResult.momentum}/5`,`Retest 慢：${yes(checked("retestSlower"))}`,`Retest 單燭弱：${yes(checked("retestWeakerCandles"))}`,
 `Retest 深度：${$("retestDepth").selectedOptions[0].textContent}`,`Retest 低量：${yes(checked("retestLowerVolume"))}`,`第二次確認：${yes(checked("secondConfirmationAfterDeepRetest"))}`,
 `交易空間：${$("tradeSpace").selectedOptions[0].textContent}`,`只得入場觸發層確認：${yes(checked("onlyEntryLayerConfirmation"))}`,`已到大局背景支持／阻力位：${yes(checked("atBackgroundSupportResistance"))}`
 ].join("\n");
}
function saveDecision(ev){
 ev.preventDefault();const symbol=$("symbol").value.trim().toUpperCase();if(!symbol){toast("請輸入市場代號");return}
 const c=tf(),r={id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,createdAt:new Date().toISOString(),symbol,
 backgroundTimeframe:c.background,mainTimeframe:c.main,secondaryTimeframe:c.secondary,entryTimeframe:$("entryTimeframe").value,
 backgroundState:$("backgroundState").value,mainState:$("mainState").value,secondaryState:$("secondaryState").value,
 transitionTag:$("transitionTag").value,direction:direction(),relation:decisionResult.relation,backgroundRelation:decisionResult.backgroundRelation,
 position:$("positionLevel").value,trigger:triggerResult.quality,marketCap:decisionResult.marketCap,finalSize:decisionResult.finalSize,
 actualSize:0,resultR:null,checklistSummary:checklist(),note:$("note").value.trim()};
 const all=records();all.unshift(r);store(all);renderHistory();toast("已儲存 V3.4 決策");
}
function formatDate(x){try{return new Intl.DateTimeFormat("zh-HK",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(x))}catch{return x}}
function renderHistory(){
 const all=records();$("statCount").textContent=all.length;
 $("statAverageSize").textContent=(all.length?all.reduce((a,x)=>a+Number(x.finalSize||0),0)/all.length:0).toFixed(2);
 const done=all.filter(x=>Number.isFinite(x.resultR));
 if(done.length){$("statAverageR").textContent=(done.reduce((a,x)=>a+x.resultR,0)/done.length).toFixed(2);$("statWinRate").textContent=`${(done.filter(x=>x.resultR>0).length/done.length*100).toFixed(1)}%`}
 else{$("statAverageR").textContent="未有資料";$("statWinRate").textContent="未有資料"}
 const list=$("historyList");if(!all.length){list.innerHTML='<article class="card empty-state">未有決策紀錄</article>';return}
 list.innerHTML=all.map(r=>`<article class="card history-card" data-id="${esc(r.id)}"><div class="history-top"><strong>${esc(r.symbol)}</strong><strong>${esc(SIZE[r.finalSize])}</strong></div>
 <p class="history-meta">${esc(r.mainTimeframe)} ${esc(r.mainState)} × ${esc(r.secondaryTimeframe)} ${esc(r.secondaryState)}<br>${esc(r.relation)}｜${esc(r.position)}｜${esc(r.trigger)}<br>${esc(formatDate(r.createdAt))}</p></article>`).join("");
 list.querySelectorAll("[data-id]").forEach(x=>x.addEventListener("click",()=>openRecord(x.dataset.id)));
}
function openRecord(id){
 const r=records().find(x=>x.id===id);if(!r)return;activeRecordId=id;$("dialogTitle").textContent=r.symbol;
 $("recordDetails").innerHTML=`<strong>大局背景：</strong>${esc(r.backgroundTimeframe)}－${esc(r.backgroundState)}<br><strong>主判斷：</strong>${esc(r.mainTimeframe)}－${esc(r.mainState)}<br><strong>次判斷：</strong>${esc(r.secondaryTimeframe)}－${esc(r.secondaryState)}<br><strong>入場觸發：</strong>${esc(r.entryTimeframe)}－${esc(r.trigger)}<br><strong>核心關係：</strong>${esc(r.relation)}<br><strong>背景關係：</strong>${esc(r.backgroundRelation)}<br><strong>方向：</strong>${esc(r.direction)}<br><strong>位置：</strong>${esc(r.position)}<br><strong>最終注碼：</strong>${esc(SIZE[r.finalSize])}`;
 $("editActualSize").value=Number(r.actualSize||0);$("editResultR").value=Number.isFinite(r.resultR)?r.resultR:"";$("editNote").value=r.note||"";$("recordDialog").showModal();
}
function saveEdit(){
 const all=records(),i=all.findIndex(x=>x.id===activeRecordId);if(i<0)return;
 const rv=$("editResultR").value.trim();all[i].actualSize=Number($("editActualSize").value||0);all[i].resultR=rv===""?null:Number(rv);all[i].note=$("editNote").value.trim();
 store(all);$("recordDialog").close();renderHistory();toast("已儲存修改");
}
function deleteRecord(){if(!activeRecordId||!confirm("確定刪除呢筆交易紀錄？"))return;store(records().filter(x=>x.id!==activeRecordId));$("recordDialog").close();renderHistory();toast("已刪除紀錄")}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCsv(){
 const all=records();if(!all.length){toast("未有紀錄可以匯出");return}
 const head=["日期","市場","大局背景時間框架","大局背景狀態","主判斷時間框架","主判斷狀態","次判斷時間框架","次判斷狀態","入場觸發時間框架","核心市場關係","大局背景關係","轉換標籤","交易方向","位置","Trigger","市場最高注碼","最終注碼","實際注碼","結果R","Checklist","備註"];
 const rows=all.map(r=>[r.createdAt,r.symbol,r.backgroundTimeframe,r.backgroundState,r.mainTimeframe,r.mainState,r.secondaryTimeframe,r.secondaryState,r.entryTimeframe,r.relation,r.backgroundRelation,r.transitionTag,r.direction,r.position,r.trigger,r.marketCap,r.finalSize,r.actualSize,Number.isFinite(r.resultR)?r.resultR:"",r.checklistSummary,r.note]);
 const blob=new Blob(["\uFEFF",[head,...rows].map(row=>row.map(csvEscape).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`MasterTrade-PWA-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast("CSV 已匯出");
}
let toastTimer;function toast(msg){clearTimeout(toastTimer);$("toast").textContent=msg;$("toast").classList.add("show");toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2200)}
function tabs(){document.querySelectorAll(".tab-button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab-button,.tab-panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active");if(b.dataset.tab==="history")renderHistory();scrollTo({top:0,behavior:"smooth"})}))}
function init(){
 ["backgroundState","mainState","secondaryState"].forEach(id=>Object.keys(STATES).forEach(s=>$(id).add(new Option(s,s))));
 $("backgroundState").value="轉換中";$("mainState").value="弱跌勢";$("secondaryState").value="健康跌勢";
 $("decisionForm").addEventListener("input",recalc);$("decisionForm").addEventListener("change",recalc);$("decisionForm").addEventListener("submit",saveDecision);
 $("exportCsv").addEventListener("click",exportCsv);$("saveRecordEdit").addEventListener("click",saveEdit);$("deleteRecord").addEventListener("click",deleteRecord);
 tabs();recalc();renderHistory();
 if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));
}
init();
})();
