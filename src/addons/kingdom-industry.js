// Fictional scenario calibration. Mass is in kilotonnes, electricity in GWh,
// employment in workers and cash in constant USD billions.
const INDUSTRIAL_GOODS = {
 oil:['النفط الخام',.00022,180], gas:['الغاز الطبيعي',.00015,140],
 ore:['خام الحديد',.00008,160], fuel:['المشتقات النفطية',.00064,190],
 copper:['خام النحاس',.00019,125], bauxite:['البوكسيت',.00009,125],
 phosphate:['الفوسفات',.00012,125], gold:['خام الذهب',.00023,90],
 steel:['الفولاذ',.00075,160]
};
const INDUSTRIAL_MINISTRIES = {energy:'وزارة الطاقة',mining:'وزارة المعادن',industry:'وزارة الصناعة'};
const INDUSTRIAL_SITES = {
 oil:{label:'حقل نفطي',ministry:'energy',good:'oil',output:140,power:0,workers:1200,capital:.12,cost:.012,months:3,extraction:true},
 gas:{label:'حقل غاز',ministry:'energy',good:'gas',output:130,power:0,workers:900,capital:.1,cost:.009,months:3,extraction:true},
 mine:{label:'منجم حديد',ministry:'mining',good:'ore',output:125,power:0,workers:1500,capital:.075,cost:.005,months:3,extraction:true},
 copper:{label:'منجم نحاس',ministry:'mining',good:'copper',output:95,power:0,workers:1250,capital:.09,cost:.007,months:3,extraction:true},
 bauxite:{label:'منجم بوكسيت',ministry:'mining',good:'bauxite',output:115,power:0,workers:1000,capital:.075,cost:.005,months:3,extraction:true},
 phosphate:{label:'منجم فوسفات',ministry:'mining',good:'phosphate',output:110,power:0,workers:1100,capital:.08,cost:.006,months:3,extraction:true},
 gold:{label:'منجم ذهب',ministry:'mining',good:'gold',output:55,power:0,workers:1400,capital:.11,cost:.009,months:4,extraction:true},
 power:{label:'محطة كهرباء غازية',ministry:'energy',output:420,input:['gas',70],power:0,workers:650,capital:.15,cost:.009,months:4},
 refinery:{label:'مصفاة نفط',ministry:'energy',good:'fuel',output:108,input:['oil',120],power:135,workers:950,capital:.18,cost:.013,months:4},
 steel:{label:'مصنع فولاذ',ministry:'industry',good:'steel',output:74,input:['ore',110],power:210,workers:1800,capital:.21,cost:.015,months:5}
};
const INDUSTRY_ORDER = Object.keys(INDUSTRIAL_SITES);
const MAX_ROYAL_FACILITIES = INDUSTRY_ORDER.length*KINGDOM_REGION_IDS.size;

function emptyRoyalIndustry(){
 return {
  stock:Object.fromEntries(Object.keys(INDUSTRIAL_GOODS).map(key=>[key,0])),
  facilities:[],last:null
 };
}

function migrateRoyalIndustry(industry){
 if(industry===undefined)return emptyRoyalIndustry();
 if(!industry||!Object.hasOwn(industry,'reserves'))return industry;
 delete industry.reserves;
 for(const good of ['copper','bauxite','phosphate','gold']){
  industry.stock[good]=0;
  if(industry.last!==null)industry.last.sales[good]={quantity:0,value:0};
 }
 return industry;
}

function approveRoyalFacility(type,region,company){
 const spec=Object.hasOwn(INDUSTRIAL_SITES,type)?INDUSTRIAL_SITES[type]:null;
 if(S.player!==KINGDOM.id||!S.kingdom||!spec||!KINGDOM_REGION_IDS.has(region))return false;
 const {industry,treasury,council:government}=S.kingdom;
 if(company!==undefined&&company!==spec.ministry)return false;
 const account=company?government.companies[company]:treasury;
 if(industry.facilities.length>=MAX_ROYAL_FACILITIES||account.cash<spec.capital||
   industry.facilities.some(site=>site.type===type&&site.region===region))return false;
 account.cash-=spec.capital;
 const site={type,region,ordered:S.month,ready:S.month+spec.months};
 if(company){
  Object.assign(site,{company,paused:false});
  account.construction+=spec.capital;
 }
 industry.facilities.push(site);
 addEvent('اعتماد مشروع صناعي',INDUSTRIAL_MINISTRIES[spec.ministry]+' · '+spec.label,'economy');
 return true;
}

function settleRoyalIndustry(){
 const realm=nation(KINGDOM.id),{industry,treasury,council:government}=S.kingdom;
 const workers=Object.fromEntries(realm.regions.map(region=>[
  region.id,realm.pop*region.populationWeight*1e6*realm.participation*(1-realm.unemployment/100)*.01
 ]));
 let power=0,spent=0,revenue=0,generated=0;
 const runs=[];
 for(const type of INDUSTRY_ORDER){
  const spec=INDUSTRIAL_SITES[type];
  for(const site of industry.facilities){
   if(site.type!==type||site.ready>S.month||site.paused)continue;
   const account=site.company?government.companies[site.company]:treasury;
   const [input,quantity]=spec.input??[];
   let utilization=Math.max(0,Math.min(1,workers[site.region]/spec.workers,account.cash/spec.cost));
   if(!Number.isFinite(utilization))utilization=0;
   if(input)utilization=Math.min(utilization,industry.stock[input]/quantity);
   if(spec.power)utilization=Math.min(utilization,power/spec.power);
   const output=spec.output*utilization;
   if(input)removeRoyalStock(input,quantity*utilization);
   power=Math.max(0,power-spec.power*utilization);
   if(type==='power'){power+=output;generated+=output;}
   else{
    industry.stock[spec.good]+=output;
    if(site.company)government.companyStock[spec.good]+=output;
   }
   workers[site.region]-=utilization*spec.workers;
   const cost=spec.cost*utilization;
   account.cash=Math.max(0,account.cash-cost);
   if(site.company)account.operating+=cost;
   else spent+=cost;
   runs.push({type,region:site.region,output,cost,workers:utilization*spec.workers});
  }
 }
 const sales={};
 for(const [good,[,price,demand]] of Object.entries(INDUSTRIAL_GOODS)){
  // Reserve feedstock for existing and commissioned downstream plants.
  const reserved=industry.facilities.reduce((sum,site)=>{
   if(site.paused)return sum;
   const input=INDUSTRIAL_SITES[site.type].input;
   return sum+(input?.[0]===good?input[1]:0);
  },0);
  const surplus=Math.max(0,industry.stock[good]-reserved);
  const quantity=Math.min(demand,surplus);
  const value=quantity*price*(1-.25*quantity/demand);
  const companyQuantity=removeRoyalStock(good,quantity);
  const companyValue=quantity?value*companyQuantity/quantity:0;
  if(companyValue){
   const company=royalCompanyForGood(good);
   company.cash+=companyValue;
   company.revenue+=companyValue;
  }
  revenue+=value-companyValue;
  sales[good]={quantity,value};
 }
 treasury.cash+=revenue;
 industry.last={month:S.month,runs,sales,generated,powerUsed:generated-power,spent,revenue};
}

const originalRoyalIndustryTick=tickHistoryV12;
tickHistoryV12=function(){
 originalRoyalIndustryTick();
 if(S.kingdom?.industry.facilities.length)settleRoyalIndustry();
};

function validateRoyalIndustry(industry,month){
 const amount=n=>Number.isFinite(n)&&n>=0;
 if(!industry||!Array.isArray(industry.facilities)||industry.facilities.length>MAX_ROYAL_FACILITIES||
   Object.keys(INDUSTRIAL_GOODS).some(key=>!amount(industry.stock?.[key])))throw Error('مخزون صناعي غير صالح.');
 const seen=new Set();
 for(const site of industry.facilities){
  if(!site||!Object.hasOwn(INDUSTRIAL_SITES,site.type))throw Error('منشأة غير معروفة.');
  const spec=INDUSTRIAL_SITES[site.type],key=site.type+':'+site.region;
  if(!KINGDOM_REGION_IDS.has(site.region)||seen.has(key)||
   !Number.isInteger(site.ordered)||site.ordered<0||site.ordered>month||site.ready!==site.ordered+spec.months)throw Error('أمر إنشاء غير صالح.');
  seen.add(key);
 }
 const l=industry.last;
 if(l===null)return;
 if(!l||!Number.isInteger(l.month)||l.month<1||l.month>month||
  !['spent','revenue','generated','powerUsed'].every(key=>amount(l[key]))||l.powerUsed>l.generated||
  !Array.isArray(l.runs)||l.runs.length>industry.facilities.length||
  l.runs.some(r=>!r||!seen.has(r.type+':'+r.region)||!['output','cost','workers'].every(key=>amount(r[key])))||
  Object.keys(INDUSTRIAL_GOODS).some(key=>!amount(l.sales?.[key]?.quantity)||!amount(l.sales[key].value))){
  throw Error('تقرير الإنتاج غير صالح.');
 }
}

const priorIndustrialEconomy=economyPanel;
economyPanel=function(n){
 const base=priorIndustrialEconomy(n);
 if(n.id!==KINGDOM.id)return base;
 const {industry,region}=S.kingdom,last=industry.last;
 const market=Object.entries(INDUSTRIAL_GOODS).map(([key,[label]])=>{
  const sale=last?.sales[key];
  const stock=metric('مخزون '+label,KINGDOM_NUMBER.format(industry.stock[key])+' ألف طن');
  if(!sale?.quantity)return stock;
  return stock+metric('مبيعات '+label,KINGDOM_NUMBER.format(sale.quantity)+' ألف طن')
   +metric('سعر بيع '+label,KINGDOM_NUMBER.format(sale.value/sale.quantity*1e6)+' دولار للطن');
 }).join('');
 const reserves=Object.values(INDUSTRIAL_SITES).filter(spec=>spec.extraction)
  .map(spec=>metric('احتياطي '+INDUSTRIAL_GOODS[spec.good][0],'غير محدود')).join('');
 const facilities=industry.facilities.map(site=>{
  const run=last?.runs.find(r=>r.type===site.type&&r.region===site.region);
  const unit=site.type==='power'?' غيغاواط ساعة':' ألف طن';
  return metric(INDUSTRIAL_SITES[site.type].label+' · '+n.regions.find(r=>r.id===site.region).name,
   site.ready>S.month?'قيد الإنشاء':run?'الإنتاج '+KINGDOM_NUMBER.format(run.output)+unit:'بانتظار أول دورة تشغيل');
 }).join('');
 return '<section class="block" dir="rtl" lang="ar"><h3>الإنتاج الصناعي</h3>'
  +metric('الإقليم المختار',n.regions.find(r=>r.id===region).name)
  +(S.player===n.id?'<label for="royalFacility">اعتماد منشأة في الإقليم</label><select id="royalFacility" class="full">'
   +INDUSTRY_ORDER.map(type=>{
    const spec=INDUSTRIAL_SITES[type];
    return '<option value="'+type+'">'+spec.label+' · '+INDUSTRIAL_MINISTRIES[spec.ministry]+' · '+kingdomMoney(spec.capital)+'</option>';
   }).join('')+'</select><button id="royalApproveFacility" class="full">اعتماد وتمويل المشروع</button>':'')
  +facilities+reserves+market
  +(last?metric('الكهرباء المنتجة',KINGDOM_NUMBER.format(last.generated)+' غيغاواط ساعة')
   +metric('الكهرباء المستهلكة',KINGDOM_NUMBER.format(last.powerUsed)+' غيغاواط ساعة')
   +metric('مبيعات الخزينة هذا الشهر',kingdomMoney(last.revenue))+metric('تكاليف تشغيل الخزينة',kingdomMoney(last.spent))
   +metric('صافي التدفق التشغيلي',kingdomMoney(last.revenue-last.spent)):'')+'</section>'+base;
};

const priorIndustryBindings=bindPanel;
bindPanel=function(){
 priorIndustryBindings();
 if(current()?.id!==KINGDOM.id||view!=='economy')return;
 const button=$('panel').querySelector('#royalApproveFacility');
 if(button)button.onclick=()=>{
  if(approveRoyalFacility($('royalFacility').value,S.kingdom.region)){
   renderPanel();
   toast('اعتمد المشروع وخُصمت تكلفة الإنشاء.');
  }else toast('تعذّر الاعتماد. تحقّق من الرصيد والإقليم والمشاريع القائمة.');
 };
};
