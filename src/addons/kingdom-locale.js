const KINGDOM_UI={
 Overview:'نظرة عامة',Cities:'المدن',Parties:'الحكم',Policies:'السياسات',Agencies:'الهيئات',
 Economy:'الاقتصاد',Growth:'النمو','Central bank':'البنك المركزي',Trade:'التجارة',
 Diplomacy:'الدبلوماسية',Military:'الدفاع',Dispatch:'الأحداث',Sandbox:'الإعدادات',Guide:'الدليل',
 'Pause simulation':'إيقاف المحاكاة','Play simulation':'تشغيل المحاكاة',
 'Simulation running':'المحاكاة تعمل','Simulation paused':'المحاكاة متوقفة',
 'National output':'الناتج الوطني',Population:'السكان','Public approval':'التأييد الشعبي',
 'Political capital':'رأس المال السياسي',Supportive:'مؤيد',Contested:'متباين',Unlimited:'غير محدود',
 Reforms:'الإصلاحات',Programs:'البرامج',Taxation:'الضرائب',Ideologies:'التوجهات',Society:'المجتمع',
 'Select nation':'اختيار الدولة','Your nation':'دولتك','Nation intelligence':'ملف الدولة','Playing as ':'تلعب باسم ',
 'Time is advancing':'الزمن يتقدم','Time is paused':'الزمن متوقف',
 'World saved to this browser.':'حُفظ العالم في هذا المتصفح.',
 'Saved world restored.':'استُعيد العالم المحفوظ.'
};

function kingdomLabel(text){
 return S?.kingdom?(KINGDOM_UI[text]??text):text;
}

const KINGDOM_COUNTRY_NAMES=new Intl.DisplayNames(['ar'],{type:'region',fallback:'none'});
function kingdomNationName(n){
 const code=CITY_CATALOG[n.id]?.iso2;
 return S?.kingdom&&/^[a-z]{2}$/i.test(code??'')?
  KINGDOM_COUNTRY_NAMES.of(code.toUpperCase())??n.name:n.name;
}

const KINGDOM_SHELL_TEXT=[
 ['.brand strong','SOVEREIGN',KINGDOM.name],['.brand .eyebrow','Political sandbox · V15','محاكاة سياسية'],
 ['.maptop h1','A world of possibilities.','خريطة العالم'],
 ['#mapmode option[value="political"]','Political control','السيطرة السياسية'],
 ['#mapmode option[value="ideology"]','Economic ideology','التوجه الاقتصادي'],
 ['#mapmode option[value="prosperity"]','Prosperity','الازدهار'],
 ['#mapmode option[value="stability"]','Stability','الاستقرار'],
 ['#saveTop','Save','حفظ'],['#allEvents','View all ↗','عرض الأحداث']
];
const KINGDOM_SHELL_ARIA=[
 ['step','Advance one month','تقديم شهر واحد'],['helpTop','How to play','طريقة اللعب'],
 ['closeModal','Close dialog','إغلاق الحوار'],['navigation','Game views','أقسام اللعبة'],
 ['mapmode','Map layer','طبقة الخريطة'],['zoomIn','Zoom in','تكبير'],
 ['zoomOut','Zoom out','تصغير'],['zoomReset','Reset map','إعادة ضبط الخريطة']
];

const priorLocalizedRender=render;
render=function(){
 if(document.documentElement){
  document.documentElement.lang=S.kingdom?'ar':'en';
  document.documentElement.dir=S.kingdom?'rtl':'ltr';
 }
 const status=playing?'Simulation running':'Simulation paused';
 $('runstatus').textContent=kingdomLabel(status);
 priorLocalizedRender();
 for(const [selector,en,ar] of KINGDOM_SHELL_TEXT){
  const element=document.querySelector?.(selector);
  if(element)element.textContent=S.kingdom?ar:en;
 }
 for(const [id,en,ar] of KINGDOM_SHELL_ARIA)$(id)?.setAttribute('aria-label',S.kingdom?ar:en);
};
