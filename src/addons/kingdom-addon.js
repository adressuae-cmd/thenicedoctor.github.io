// Alternate 1990 scenario on the Sovereign world. Only the Crown enters the national tick.
const KINGDOM = {id:'UHK',name:'المملكة الهاشمية المتحدة',capital:'يثرب',lon:39.61,lat:24.47,flag:'♜'};
const KINGDOM_REGIONS = [
 ['ARE','الإمارات'],['SAU','السعودية'],['OMN','عُمان'],['QAT','قطر'],
 ['KWT','الكويت'],['BHR','البحرين'],['YEM','اليمن'],['IRQ','العراق'],
 ['IRN','إقليم الفرس'],['AFG','أفغانستان'],['SYR','سوريا'],['PSE','فلسطين'],
 ['LBN','لبنان'],['JOR','الأردن'],['SDN','السودان'],['EGY','مصر'],
 ['LBY','ليبيا'],['TUN','تونس'],['DZA','الجزائر'],['MAR','المغرب'],
 ['MRT','موريتانيا'],['TUR','تركيا'],['TKM','تركمانستان'],['UZB','أوزبكستان'],
 ['KAZ','كازاخستان'],['ETH','إثيوبيا'],['IND','الهند'],['PAK','باكستان']
];
const KINGDOM_REGION_IDS = new Set(KINGDOM_REGIONS.map(([id])=>id));
const KINGDOM_MAP_SUPPLEMENT = JSON.parse($('kingdom-map').textContent);

function registerKingdomCities(){
 const cities=KINGDOM_REGIONS.flatMap(([id])=>baseCityCatalogV15[id].cities);
 CITY_CATALOG[KINGDOM.id]={name:KINGDOM.name,cities,kind:'city',iso2:null,flag:KINGDOM.flag};
}

const originalCityTemplateKingdom=cityTemplate;
cityTemplate=function(n){
 if(n.id!==KINGDOM.id)return originalCityTemplateKingdom(n);
 return n.regions.flatMap(region=>{
  const cities=originalCityTemplateKingdom({...n,id:region.id});
  return cities.map(city=>({
   ...city,
   name:region.id==='SAU'&&city.name==='Medina'?KINGDOM.capital:city.name,
   share:city.share*region.outputWeight,
   populationShare:city.share*region.populationWeight
  }));
 });
};

const originalNationMetaKingdom=validNationMetaV8;
validNationMetaV8=function(n){
 if(n.id!==KINGDOM.id)return originalNationMetaKingdom(n);
 return ['name','lon','lat','flag'].every(key=>n[key]===KINGDOM[key]);
};

const originalRegimeKingdom=regime;
regime=function(n){
 return n.id===KINGDOM.id?'ملكية مركزية':originalRegimeKingdom(n);
};

const originalPoliticsKingdom=tickPolitics;
tickPolitics=function(n){
 if(n.id!==KINGDOM.id)originalPoliticsKingdom(n);
};

const originalPartiesKingdom=partiesPanel;
partiesPanel=function(n){
 if(n.id!==KINGDOM.id)return originalPartiesKingdom(n);
 return '<section dir="rtl" lang="ar"><h3>الحكم المركزي</h3>'
  +'<p>تتبع الأقاليم الثمانية والعشرون التاج الملكي. العاصمة الملكية في يثرب.</p></section>';
};

const originalPathsKingdom=initPaths;
initPaths=function(){
 originalPathsKingdom();
 if(!S.kingdom)return;
 for(const [id,rings] of Object.entries(KINGDOM_MAP_SUPPLEMENT)){
  const polygon=paths.find(entry=>entry.id===id);
  const path=polygon?.path??new Path2D();
  for(const ring of rings){
   ring.forEach(([lon,lat],index)=>{
    const [x,y]=project(lon,lat);
    if(index===0)path.moveTo(x,y);else path.lineTo(x,y);
   });
   path.closePath();
  }
  if(!polygon)paths.push({id,path});
 }
};

// The map's large nation markers must not intercept clicks inside small provinces.
function kingdomRegionAt(mx,my){
 ctx.save();
 ctx.setTransform(1,0,0,1,0,0);
 const region=paths.find(item=>KINGDOM_REGION_IDS.has(item.id)&&
  ctx.isPointInPath(item.path,mx,my,'evenodd'));
 ctx.restore();
 return region?.id??null;
}

function selectMapNationKingdom(id,x,y){
 if(S.kingdom&&id===KINGDOM.id){
  const t=transform();
  const region=kingdomRegionAt((x-t.x)/t.scale,(y-t.y)/t.scale);
  if(region)S.kingdom.region=region;
 }
 choose(id);
}

function startKingdom(){
 startPause(false);
 newGame();
 // Start from the intact Sovereign catalogue so every constituent is present before consolidation.
 applyDifficulty('medium',true);
 const parts=KINGDOM_REGIONS.map(([id])=>nation(id));
 if(parts.some(n=>!n))throw Error('Missing constituent in the Sovereign world.');
 const sum=key=>parts.reduce((total,n)=>total+n[key],0);
 const pop=sum('pop'),gdp=sum('gdp'),debt=sum('debt');
 const weighted=key=>parts.reduce((value,n)=>value+n[key]*n.gdp/gdp,0);
 const saudi=nation('SAU');
 const realm=seedNation([KINGDOM.id,KINGDOM.name,pop,gdp,debt/gdp*100,
  weighted('growth'),weighted('inflation'),saudi.policies.liberties,saudi.policies.institutions,
  saudi.preset,KINGDOM.lon,KINGDOM.lat,KINGDOM.flag]);
 const oldCities=new Map(parts.flatMap(n=>n.cities).map(city=>[city.id,city]));
 realm.regions=parts.map((n,index)=>({
  id:n.id, name:KINGDOM_REGIONS[index][1], initialPopulation:n.pop, initialOutput:n.gdp,
  populationWeight:n.pop/pop, outputWeight:n.gdp/gdp,
  tradeCapacity:Object.fromEntries(Object.keys(GOODS).map(good=>[good,exportCapacity(n,good)]))
 }));
 registerKingdomCities();
 ensureV4(realm);
 upgradeNationV5(realm);
 realm.cities=cityTemplate(realm).map(city=>({...city,...oldCities.get(city.id),
  name:city.name,share:city.share,populationShare:city.populationShare}));
 for(const key of ['capacity','human','infra','clean','inequality','unemployment','readiness']){
  realm[key]=weighted(key);
 }
 upgradeNationEconV5(realm);
 realm.capitalStock=sum('capitalStock');
 realm.tfp=realm.potentialGdp/(Math.pow(realm.capitalStock,ALPHA)*
  Math.pow(Math.max(.005,realm.pop*realm.participation*(1-realm.nairu/100)),1-ALPHA));
 realm.tfpBase=realm.tfp;
 realm.fund=sum('fund');
 realm.forces=Object.fromEntries(Object.keys(realm.forces).map(key=>
  [key,parts.reduce((total,n)=>total+n.forces[key],0)]));
 realm.military=Object.values(realm.forces).reduce((total,force)=>total+force,0);
 realm.unrest=0;
 realm.redenominations=0;
 seedAgenciesV14(realm);
 neutralReformsV15(realm);
 seedBudgetV15(realm);

 S.nations=S.nations.filter(n=>!KINGDOM_REGION_IDS.has(n.id));
 S.nations.push(realm);
 S.kingdom={region:'SAU',government:'centralized-monarchy',capital:KINGDOM.capital,
  treasury:{cash:0,last:null,transfers:[]}};
 S.startYear=1990;
 S.startMonth=0;
 S.options.historyEvents=false;
 S.historyDone=TIMELINE.map((_,index)=>index);
 S.player=selected=KINGDOM.id;
 for(const id of KINGDOM_REGION_IDS)S.territory[id]=KINGDOM.id;
 const retained=key=>key.split(':').every(id=>!KINGDOM_REGION_IDS.has(id));
 S.relations=Object.fromEntries(Object.entries(S.relations).filter(([key])=>retained(key)));
 S.agreements=[];
 S.embargoes=[];
 S.tradeDeals=[];
 S.tradeFlows=[];
 syncDiplomacy();
 rebuildNeighboursV12();
 refreshWorld();
 initPaths();
 addEvent('تأسيس المملكة','أصبحت الأقاليم الثمانية والعشرون تحت إدارة التاج الملكي في يثرب.','dispatch');
 wasPlaying=false;
 if(!$('overlay').hidden)closeModal();
 view='overview';
 subview='overview';
 render();
}

const originalSaveValidatorKingdom=validSave;
validSave=function(s){
 if(s?.kingdom){
  const hasInternalPartner=key=>key.split(':').some(id=>KINGDOM_REGION_IDS.has(id));
  if(Object.keys(s.relations??{}).some(hasInternalPartner)){
   throw Error('لا تُسجّل علاقات دبلوماسية مع أقاليم المملكة.');
  }
  const realm=s.nations?.find(n=>n.id===KINGDOM.id);
  if(!realm||s.nations.some(n=>KINGDOM_REGION_IDS.has(n.id))||
   s.startYear!==1990||s.startMonth!==0||
   s.kingdom.government!=='centralized-monarchy'||s.kingdom.capital!==KINGDOM.capital||
   !KINGDOM_REGION_IDS.has(s.kingdom.region)||!Array.isArray(realm.regions)||
   realm.regions.length!==KINGDOM_REGIONS.length||!validKingdomTreasury(s.kingdom.treasury,s.month))throw Error('بيانات اتحاد المملكة غير صالحة.');
  for(const [index,[id,name]] of KINGDOM_REGIONS.entries()){
   const r=realm.regions[index];
   if(!r||r.id!==id||r.name!==name||s.territory?.[id]!==KINGDOM.id||
    ['initialPopulation','initialOutput','populationWeight','outputWeight']
     .some(key=>!Number.isFinite(r[key])||r[key]<=0)||
    Object.keys(GOODS).some(key=>!Number.isFinite(r.tradeCapacity?.[key])||r.tradeCapacity[key]<0)){
    throw Error('بيانات أحد الأقاليم غير صالحة.');
   }
  }
  for(const key of ['populationWeight','outputWeight']){
   if(Math.abs(realm.regions.reduce((sum,r)=>sum+r[key],0)-1)>1e-9)throw Error('أوزان الأقاليم غير متوازنة.');
  }
 }else if(s?.nations?.some?.(n=>n.id===KINGDOM.id)){
  throw Error('حالة الاتحاد مفقودة.');
 }
 const result=originalSaveValidatorKingdom(s);
 if(s.kingdom){
  const realm=s.nations.find(n=>n.id===KINGDOM.id);
  const expected=cityTemplate(realm);
  if(realm.cities.some((city,index)=>!Number.isFinite(city.populationShare)||
    Math.abs(city.populationShare-expected[index].populationShare)>1e-9)){
   throw Error('حصة سكان المدينة غير صالحة.');
  }
 }
 return result;
};

const originalExportCapacityKingdom=exportCapacity;
exportCapacity=function(n,good){
 if(n.id!==KINGDOM.id)return originalExportCapacityKingdom(n,good);
 return n.regions.reduce((total,r)=>total+r.tradeCapacity[good],0)*
  (n.gdp/n.regions.reduce((total,r)=>total+r.initialOutput,0));
};

const originalStartScreenKingdom=startScreen;
startScreen=function(){
 originalStartScreenKingdom();
 $('modalContent').insertAdjacentHTML('afterbegin',
  '<section dir="rtl" lang="ar"><button id="startKingdom" class="primary full">'
  +'المملكة الهاشمية المتحدة · ١ يناير ١٩٩٠</button></section>');
 const button=$('startKingdom');
 if(button)button.onclick=startKingdom;
};

const KINGDOM_NUMBER=new Intl.NumberFormat('ar',{maximumFractionDigits:3});
function kingdomMoney(value){return KINGDOM_NUMBER.format(value)+' مليار دولار';}

const originalKingdomOverview=overview;
overview=function(n){
 const base=originalKingdomOverview(n);
 if(n.id!==KINGDOM.id||subview!=='overview')return base;
 const r=n.regions.find(region=>region.id===S.kingdom.region);
 const cityCount=n.cities.filter(city=>city.id.startsWith(r.id+'-')).length;
 return '<section dir="rtl" lang="ar" class="block"><h3>أقاليم المملكة</h3>'
  +'<label for="royalRegion">الإقليم الإداري</label>'
  +'<select id="royalRegion" class="full">'+n.regions.map(region=>
   '<option value="'+region.id+'"'+(region===r?' selected':'')+'>'+region.name+'</option>').join('')+'</select>'
  +metric('العاصمة الملكية',S.kingdom.capital)
  +metric('السكان',KINGDOM_NUMBER.format(n.pop*r.populationWeight)+' مليون')
  +metric('حصة الناتج',kingdomMoney(n.gdp*r.outputWeight))
  +metric('المدن المتاحة للتطوير',KINGDOM_NUMBER.format(cityCount))
  +'<button id="royalRegionCities" class="full">إدارة مدن الإقليم</button></section>'+base;
};

const originalKingdomRegionBindings=bindPanel;
bindPanel=function(){
 originalKingdomRegionBindings();
 if(current()?.id!==KINGDOM.id||view!=='overview'||subview!=='overview')return;
 const region=$('panel').querySelector('#royalRegion');
 if(region)region.onchange=()=>{
  if(!KINGDOM_REGION_IDS.has(region.value))return;
  S.kingdom.region=region.value;
  renderPanel();
 };
 const cities=$('panel').querySelector('#royalRegionCities');
 if(cities)cities.onclick=()=>{
  const prefix=S.kingdom.region+'-';
  activeCity=current().cities.findIndex(city=>city.id.startsWith(prefix));
  setView('cities');
 };
};
