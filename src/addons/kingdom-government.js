// The council works offline. Delegates read the simulation and propose orders for the player.
const ROYAL_COMPANIES={
 energy:'شركة المملكة للطاقة',mining:'شركة المملكة للتعدين',industry:'شركة المملكة للصناعات'
};
const ROYAL_DELEGATES={
 energy:'وكيل الطاقة',mining:'وكيل المعادن',industry:'وكيل الصناعة'
};
const ROYAL_ORDER_ACTIONS={
 appropriate:'تخصيص ميزانية للوزارة',capitalize:'تمويل الشركة من الوزارة',
 construct:'اعتماد منشأة للشركة',transfer:'نقل منشأة عامة إلى الشركة',suspend:'تعليق تشغيل المنشأة',resume:'استئناف تشغيل المنشأة'
};
const ROYAL_LEDGER_LIMIT=200;

function emptyRoyalGovernment(){
 return {
  ministries:Object.fromEntries(Object.keys(ROYAL_COMPANIES).map(key=>[key,{cash:0}])),
  companies:Object.fromEntries(Object.keys(ROYAL_COMPANIES).map(key=>[key,{cash:0,revenue:0,operating:0,construction:0}])),
  companyStock:Object.fromEntries(Object.keys(INDUSTRIAL_GOODS).map(key=>[key,0])),
  orders:[],nextOrder:1
 };
}

function royalFundingOrder(kind,sector,amount){
 const {treasury,council:government}=S.kingdom;
 const ministry=government.ministries[sector],company=government.companies[sector];
 const from=kind==='appropriate'?treasury:ministry,to=kind==='appropriate'?ministry:company;
 if(!Number.isFinite(amount)||amount<=0||from.cash<amount||!Number.isFinite(to.cash+amount))return false;
 from.cash-=amount;
 to.cash+=amount;
 return true;
}

function executeRoyalOrder(kind,sector,{amount,type,region,source='king'}={}){
 if(!S.kingdom||S.player!==KINGDOM.id||!Object.hasOwn(ROYAL_COMPANIES,sector)||
   !Object.hasOwn(ROYAL_ORDER_ACTIONS,kind)||!['king','zayed'].includes(source))return false;
 const {council:government,industry}=S.kingdom;
 const isFunding=kind==='appropriate'||kind==='capitalize';
 if(isFunding){
  if(!royalFundingOrder(kind,sector,amount))return false;
 }else{
  if(!Object.hasOwn(INDUSTRIAL_SITES,type)||!KINGDOM_REGION_IDS.has(region)||
    INDUSTRIAL_SITES[type].ministry!==sector)return false;
  if(kind==='construct'){
   if(!approveRoyalFacility(type,region,sector))return false;
  }else if(kind==='transfer'){
   const site=industry.facilities.find(site=>site.type===type&&site.region===region&&site.company===undefined);
   if(!site)return false;
   Object.assign(site,{company:sector,paused:false});
  }else{
   const site=industry.facilities.find(site=>site.type===type&&site.region===region&&site.company===sector);
   const paused=kind==='suspend';
   if(!site||site.paused===paused)return false;
   site.paused=paused;
  }
 }
 const order={id:government.nextOrder++,month:S.month,kind,sector,source};
 if(isFunding)order.amount=amount;
 else Object.assign(order,{type,region});
 government.orders.push(order);
 if(government.orders.length>ROYAL_LEDGER_LIMIT)government.orders.shift();
 addEvent('صدر أمر ملكي',ROYAL_ORDER_ACTIONS[kind]+' · '+INDUSTRIAL_MINISTRIES[sector],'economy');
 return true;
}

function royalCompanyForGood(good){
 const site=Object.values(INDUSTRIAL_SITES).find(spec=>spec.good===good);
 return S.kingdom.council.companies[site.ministry];
}

function removeRoyalStock(good,quantity){
 const {industry,council:government}=S.kingdom;
 const stock=industry.stock[good];
 const companyQuantity=stock?Math.min(quantity,quantity*government.companyStock[good]/stock):0;
 industry.stock[good]=Math.max(0,stock-quantity);
 government.companyStock[good]=Math.max(0,Math.min(industry.stock[good],government.companyStock[good]-companyQuantity));
 return companyQuantity;
}

// Forecast one month of shared supply when the proposed site is ready.
function royalProjectDependencies(type){
 const spec=INDUSTRIAL_SITES[type],{facilities,stock}=S.kingdom.industry;
 if(!spec.input&&!spec.power)return [];
 const active=facilities.filter(site=>!site.paused&&site.ready<=S.month+spec.months)
  .map(site=>INDUSTRIAL_SITES[site.type]);
 const supply=good=>stock[good]+active.reduce((qty,site)=>qty+(site.good===good?site.output:0),0);
 const demand=good=>active.reduce((qty,site)=>qty+(site.input?.[0]===good?site.input[1]:0),0);
 const missing=[];
 if(spec.input){
  const [good,quantity]=spec.input;
  if(supply(good)-demand(good)<quantity)missing.push(INDUSTRIAL_GOODS[good][0]);
 }
 if(spec.power){
  const plants=active.filter(site=>site===INDUSTRIAL_SITES.power);
  const gasNeeded=demand('gas'),gas=supply('gas');
  const electricalOutput=plants.length*INDUSTRIAL_SITES.power.output*(gasNeeded?Math.min(1,gas/gasNeeded):0);
  const committed=active.reduce((qty,site)=>qty+site.power,0);
  if(electricalOutput-committed<spec.power){
   missing.push('الكهرباء');
   if(plants.length&&gas<gasNeeded)missing.push(INDUSTRIAL_GOODS.gas[0]);
  }
 }
 return missing;
}

function zayedRecommendations(region){
 if(!S.kingdom||!KINGDOM_REGION_IDS.has(region))return [];
 const {industry,council:government,treasury}=S.kingdom;
 return Object.keys(ROYAL_DELEGATES).flatMap(sector=>{
  const candidates=INDUSTRY_ORDER.filter(type=>INDUSTRIAL_SITES[type].ministry===sector&&
   !industry.facilities.some(site=>site.type===type&&site.region===region));
  if(!candidates.length)return [];
  const readyType=candidates.find(type=>royalProjectDependencies(type).length===0);
  const specKey=readyType??candidates[0];
  const spec=INDUSTRIAL_SITES[specKey];
  const message=spec.label+' · '+nation(KINGDOM.id).regions.find(r=>r.id===region).name;
  if(!readyType)return [{
   sector,kind:'construct',type:specKey,region,message,ready:false,
   reason:'أمّن هذه المدخلات قبل الاعتماد: '+royalProjectDependencies(specKey).join('، ')
  }];
  const company=government.companies[sector],ministry=government.ministries[sector];
  const needed=Math.max(0,spec.capital+spec.cost-company.cash);
  if(needed===0)return [{sector,kind:'construct',type:specKey,region,message,ready:true}];
  if(ministry.cash>=needed)return [{sector,kind:'capitalize',amount:needed,message,ready:true}];
  const amount=needed-ministry.cash;
  return [{sector,kind:'appropriate',amount,message,ready:treasury.cash>=amount,
   reason:treasury.cash<amount?'رصيد الخزينة لا يغطي التخصيص المقترح.':null}];
 });
}

function validateRoyalGovernment(kingdom,month){
 const {council:g,industry}=kingdom;
 const money=value=>Number.isFinite(value)&&value>=0;
 const fail=()=>{throw Error('بيانات الديوان الملكي غير صالحة.');};
 if(!g||!Number.isSafeInteger(g.nextOrder)||g.nextOrder<1||
   !Array.isArray(g.orders)||g.orders.length>ROYAL_LEDGER_LIMIT)fail();
 for(const sector of Object.keys(ROYAL_COMPANIES)){
  if(!money(g.ministries?.[sector]?.cash)||
    !['cash','revenue','operating','construction'].every(key=>money(g.companies?.[sector]?.[key])))fail();
 }
 for(const good of Object.keys(INDUSTRIAL_GOODS)){
  if(!money(g.companyStock?.[good])||g.companyStock[good]>industry.stock[good])fail();
 }
 for(const site of industry.facilities){
  if(site.company!==undefined&&
    (site.company!==INDUSTRIAL_SITES[site.type].ministry||typeof site.paused!=='boolean'))fail();
 }
 let previous=0;
 for(const order of g.orders){
  if(!order||!Number.isSafeInteger(order.id)||order.id<=previous||order.id>=g.nextOrder||
    !Number.isInteger(order.month)||order.month<0||order.month>month||
    !Object.hasOwn(ROYAL_ORDER_ACTIONS,order.kind)||!Object.hasOwn(ROYAL_COMPANIES,order.sector)||
    !['king','zayed'].includes(order.source))fail();
  if(order.kind==='appropriate'||order.kind==='capitalize'){
   if(!money(order.amount)||order.amount===0)fail();
  }else if(!Object.hasOwn(INDUSTRIAL_SITES,order.type)||!KINGDOM_REGION_IDS.has(order.region)||
    INDUSTRIAL_SITES[order.type].ministry!==order.sector)fail();
  previous=order.id;
 }
}

function royalSelect(id,label,options){
 return '<label for="'+id+'">'+label+'</label><select class="full" id="'+id+'">'
  +options.map(([key,name])=>'<option value="'+key+'">'+name+'</option>').join('')+'</select>';
}

function royalCouncilPanel(n){
 const {council:g,region,industry}=S.kingdom,owned=S.player===n.id;
 const reports=Object.keys(ROYAL_COMPANIES).map(sector=>{
  const c=g.companies[sector];
  const sites=industry.facilities.filter(site=>site.company===sector);
  return '<div class="projectcard"><h4>'+INDUSTRIAL_MINISTRIES[sector]+'</h4>'
   +metric('الميزانية المتاحة',kingdomMoney(g.ministries[sector].cash))
   +'<h4>'+ROYAL_COMPANIES[sector]+'</h4>'
   +metric('الرصيد',kingdomMoney(c.cash))+metric('المبيعات المتراكمة',kingdomMoney(c.revenue))
   +metric('نفقات التشغيل المتراكمة',kingdomMoney(c.operating))+metric('تكاليف الإنشاء المتراكمة',kingdomMoney(c.construction))
   +sites.map(site=>{
    const label=INDUSTRIAL_SITES[site.type].label+' · '+n.regions.find(r=>r.id===site.region).name;
    return metric(label,site.paused?'معلّقة':site.ready>S.month?'قيد الإنشاء':'متاحة للتشغيل')
     +(owned?'<button data-council-site="'+site.type+':'+site.region+'">'
      +(site.paused?'استئناف التشغيل':'تعليق التشغيل')+'</button>':'');
   }).join('')+'</div>';
 }).join('');
 const orderControls=owned?'<div class="block"><h3>الأوامر الملكية</h3>'
  +royalSelect('royalOrderSector','الوزارة',Object.entries(INDUSTRIAL_MINISTRIES))
  +'<label for="royalOrderAmount">المبلغ بمليارات الدولارات</label>'
  +'<input id="royalOrderAmount" type="number" min="0" step="any" dir="ltr">'
  +'<div class="buttonrow"><button id="royalAppropriate">تخصيص من الخزينة</button>'
  +'<button id="royalCapitalize">تمويل الشركة</button></div>'
  +royalSelect('royalOrderProject','منشأة الشركة',INDUSTRY_ORDER.map(type=>[type,INDUSTRIAL_SITES[type].label]))
  +royalSelect('royalOrderRegion','إقليم المشروع',KINGDOM_REGIONS.map(([id,name])=>[id,name]))
  +'<button id="royalConstruct" class="primary full">اعتماد إنشاء المنشأة</button></div>':'';
 const publicSites=owned?industry.facilities.filter(site=>site.company===undefined).map(site=>
  metric(INDUSTRIAL_SITES[site.type].label+' · '+n.regions.find(r=>r.id===site.region).name,'على حساب الخزينة')
  +'<button data-royal-transfer-site="'+site.type+':'+site.region+'">نقل إلى '+ROYAL_COMPANIES[INDUSTRIAL_SITES[site.type].ministry]+'</button>'
 ).join(''):'';
 const suggestions=owned?'<div class="block"><h3>زايد والوكلاء</h3>'
  +'<p>يجمع زايد توصيات وكلاء الوزارات. تُنفَّذ التوصية بعد اعتمادك.</p>'
  +'<p>توصيات إقليم '+n.regions.find(r=>r.id===region).name+'</p>'
  +metric('الرصيد المتاح قبل التوصيات',kingdomMoney(S.kingdom.treasury.cash))
  +zayedRecommendations(region).map((proposal,index)=>
   '<div class="projectcard"><strong>'+ROYAL_DELEGATES[proposal.sector]+'</strong>'
   +'<p>'+ROYAL_ORDER_ACTIONS[proposal.kind]+' · '+proposal.message+'</p>'
   +(proposal.amount?metric('التمويل المقترح',kingdomMoney(proposal.amount)):'')
   +(proposal.reason?'<p class="note">'+proposal.reason+'</p>':'')
   +'<button data-zayed="'+index+'"'+(proposal.ready?'':' disabled')+'>اعتماد التوصية</button></div>'
  ).join('')+'</div>':'';
 const orders=g.orders.slice(-10).reverse().map(order=>
  metric(KINGDOM_NUMBER.format(order.id)+' · '+ROYAL_ORDER_ACTIONS[order.kind],
   INDUSTRIAL_MINISTRIES[order.sector]+(order.amount?' · '+kingdomMoney(order.amount):'')
   +(order.source==='zayed'?' · توصية زايد':''))).join('');
 return '<section dir="rtl" lang="ar"><h3>الديوان الملكي</h3>'+suggestions+orderControls+reports+
  (publicSites?'<h3>المنشآت العامة القابلة للنقل</h3>'+publicSites:'')+'<h3>آخر الأوامر</h3>'+(orders||'<p>سجل الأوامر فارغ.</p>')+'</section>';
}

const previousCouncilPanel=renderPanel;
renderPanel=function(){
 if(view!=='agencies'||current()?.id!==KINGDOM.id)return previousCouncilPanel();
 const panel=$('panel');
 const fields=['royalOrderSector','royalOrderAmount','royalOrderProject','royalOrderRegion'];
 const inputs=fields.map(id=>panel.querySelector('#'+id)?.value);
 panel.innerHTML=royalCouncilPanel(current());
 fields.forEach((id,index)=>{
  const field=panel.querySelector('#'+id);
  if(field&&inputs[index]!==undefined)field.value=inputs[index];
 });
 bindPanel();
};
const previousCouncilBinding=bindPanel;
bindPanel=function(){
 previousCouncilBinding();
 if(view!=='agencies'||current()?.id!==KINGDOM.id||S.player!==KINGDOM.id)return;
 const panel=$('panel');
 const issue=(kind,sector,details)=>{
  if(!executeRoyalOrder(kind,sector,details)){
   toast('تعذّر تنفيذ الأمر. تحقّق من الرصيد والمنشآت القائمة.');
   return;
  }
  renderPanel();
  toast('نُفّذ الأمر الملكي وسُجّل في الديوان.');
 };
 for(const [id,kind] of [['royalAppropriate','appropriate'],['royalCapitalize','capitalize']]){
  const button=panel.querySelector('#'+id);
  if(button)button.onclick=()=>issue(kind,$('royalOrderSector').value,{amount:Number($('royalOrderAmount').value)});
 }
 const construct=panel.querySelector('#royalConstruct');
 if(construct)construct.onclick=()=>{
  const type=$('royalOrderProject').value;
  issue('construct',INDUSTRIAL_SITES[type]?.ministry,{type,region:$('royalOrderRegion').value});
 };
 panel.querySelectorAll('[data-council-site]').forEach(button=>button.onclick=()=>{
  const [type,region]=button.dataset.councilSite.split(':');
  const site=S.kingdom.industry.facilities.find(site=>site.type===type&&site.region===region);
  if(site)issue(site.paused?'resume':'suspend',site.company,{type,region});
 });
 panel.querySelectorAll('[data-royal-transfer-site]').forEach(button=>button.onclick=()=>{
  const [type,region]=button.dataset.royalTransferSite.split(':');
  issue('transfer',INDUSTRIAL_SITES[type]?.ministry,{type,region});
 });
 const proposals=zayedRecommendations(S.kingdom.region);
 panel.querySelectorAll('[data-zayed]').forEach(button=>button.onclick=()=>{
  const p=proposals[Number(button.dataset.zayed)];
  if(p?.ready)issue(p.kind,p.sector,{...p,source:'zayed'});
 });
};
