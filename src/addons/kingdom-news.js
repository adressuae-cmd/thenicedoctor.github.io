// Monthly newspaper copy is generated from the same state as the Sovereign stories.
const newsPct=value=>KINGDOM_NUMBER.format(value)+'٪';
const newsNumber=value=>KINGDOM_NUMBER.format(value);
const newsMoney=value=>'$'+newsNumber(value);
const newsCity=name=>kingdomLabel(name);
const KINGDOM_NEWS={
 inflationBite:n=>['الأسعار تسبق الأجور',
  'بلغ التضخم '+newsPct(n.inflation)+' مقابل توقعات عند '+newsPct(n.mon.expected)+'. معدل الفائدة '+newsPct(n.mon.rate)+'.'],
 deflation:n=>['ضعف الطلب يضغط على الأسعار',
  'بلغ التضخم '+newsPct(n.inflation)+' وفجوة الناتج '+newsPct(n.outputGap)+'. البطالة '+newsPct(n.unemployment)+'.'],
 boom:n=>['الطلب يتجاوز قدرة الاقتصاد',
  'الناتج أعلى من مستواه المحتمل بنسبة '+newsPct(n.outputGap)+'. النمو '+newsPct(n.growth)+' والتضخم '+newsPct(n.inflation)+'.'],
 recession:n=>['الاقتصاد يتراجع',
  'النمو '+newsPct(n.growth)+' والبطالة '+newsPct(n.unemployment)+'. فجوة الناتج '+newsPct(n.outputGap)+'.'],
 convergence:n=>['الاقتصاد يقترب من مستويات إنتاجية أعلى',
  'نمو الناتج المحتمل '+newsPct(n.potentialGrowth)+'. الناتج للفرد '+newsMoney(n.gdp/n.pop*1000)+'.'],
 stagnation:n=>['تباطؤ نمو القدرة الإنتاجية',
  'نمو الناتج المحتمل '+newsPct(n.potentialGrowth)+' ومساهمة الإنتاجية '+newsPct(n.tfpGrowth)+'.'],
 ratesUp:n=>['رفع سعر الفائدة',
  'أصبح سعر السياسة '+newsPct(n.mon.rate)+'، والتضخم المتوقع '+newsPct(n.mon.expected)+'. هامش الإقراض '+newsNumber(n.mon.spread)+' نقطة.'],
 ratesDown:n=>['خفض سعر الفائدة',
  'أصبح سعر السياسة '+newsPct(n.mon.rate)+'، والسعر الحقيقي المتوقع '+newsPct(n.mon.rate-n.mon.expected)+'.'],
 credibility:n=>['تراجع الثقة بهدف التضخم',
  'مصداقية البنك '+newsNumber(n.mon.credibility)+' من ١٠٠. التوقعات '+newsPct(n.mon.expected)+' مقابل الهدف '+newsPct(n.policies.inflationTarget)+'.'],
 currency:n=>['انحراف في سعر الصرف الحقيقي',
  'يبلغ مؤشر سعر الصرف الحقيقي '+newsNumber(n.reer)+' مقارنة بأساس ١٠٠. الحساب الجاري '+newsPct(n.currentAccount)+'.'],
 unemployment:n=>['البطالة تتجاوز حدها الهيكلي',
  'البطالة '+newsPct(n.unemployment)+' مقابل حد هيكلي '+newsPct(n.nairu)+'. فجوة الناتج '+newsPct(n.outputGap)+'.'],
 inequality:n=>['اتساع تفاوت الدخل',
  'مؤشر تفاوت الدخل '+newsNumber(n.inequality)+' من ١٠٠. الحماية الاجتماعية تعادل '+newsPct(n.policies.welfare)+' من الناتج.'],
 crime:n=>['ارتفاع ضغط الجريمة',
  'مؤشر ضغط الجريمة '+newsNumber(n.crime)+' من ١٠٠. البطالة '+newsPct(n.unemployment)+'.'],
 safeCities:n=>['تحسّن السلامة في المدن',
  'تراجع ضغط الجريمة إلى '+newsNumber(n.crime)+' من ١٠٠، وبلغ رضا السكان '+newsNumber(n.citySatisfaction)+'.'],
 approvalLow:n=>['تراجع التأييد الشعبي',
  'بلغ التأييد '+newsPct(n.approval)+' والاستقرار '+newsNumber(n.stability)+' من ١٠٠.'],
 approvalHigh:n=>['ارتفاع التأييد الشعبي',
  'بلغ التأييد '+newsPct(n.approval)+'. النمو '+newsPct(n.growth)+' والتضخم '+newsPct(n.inflation)+'.'],
 debtStress:n=>['ضغط على المالية العامة',
  'بلغ الدين '+newsPct(n.debt/n.gdp*100)+' من الناتج. رصيد الميزانية '+newsPct(fiscal(n).balance)+' من الناتج.'],
 tradeGrowth:n=>['التجارة تدعم النمو',
  'صادرات الشهر '+kingdomMoney(n.exports)+' ووارداته '+kingdomMoney(n.imports)+'.'],
 sanctioned:n=>['العقوبات تضغط على النشاط الاقتصادي',
  'عدد العقوبات المرتبطة بالدولة '+newsNumber(S.sanctions.filter(item=>item.split(':').includes(n.id)).length)+'.'],
 coldWorld:()=>['التضخم يرتفع عالمياً',
  'التضخم العالمي '+newsPct(worldInflation)+' والفائدة '+newsPct(worldRate)+' والنمو '+newsPct(worldGrowth)+'.'],
 worldBoom:()=>['تسارع الاقتصاد العالمي',
  'النمو العالمي '+newsPct(worldGrowth)+' والتضخم '+newsPct(worldInflation)+'.'],
 steady:n=>['أداء اقتصادي مستقر',
  'النمو '+newsPct(n.growth)+' والتضخم '+newsPct(n.inflation)+' والبطالة '+newsPct(n.unemployment)+'.'],
 election:n=>['اقتراب الانتخابات',
  'باقٍ '+newsNumber(n.election)+' شهراً للانتخابات. التأييد '+newsPct(n.approval)+' والنمو '+newsPct(n.growth)+'.'],
 cityBuild:n=>{
  const c=n.cities.find(city=>city.queue.length),project=c.queue[0];
  return ['مشروع قيد الإنشاء في '+newsCity(c.name),
   kingdomLabel(PROJECTS[project.type].name)+' · تبقّى '+newsNumber(project.remaining)+' من أصل '+newsNumber(project.duration)+' شهراً.'];
 },
 population:n=>[n.popGrowth>0?'السكان في ازدياد':'السكان في تراجع',
  'عدد السكان '+newsNumber(n.pop)+' مليون. معدل التغير السنوي '+newsPct(n.popGrowth*100)+' والمشاركة في العمل '+newsPct(n.participation*100)+'.'],
 reserves:n=>['ارتفاع رصيد الصندوق السيادي',
  'يبلغ رصيد الصندوق '+kingdomMoney(n.fund)+'، أي '+newsPct(n.fund/n.gdp*100)+' من الناتج السنوي.'],
 era:n=>['مرور عقد على بداية الفترة',
  'النمو في الوقت الحالي '+newsPct(n.growth)+' والناتج للفرد '+newsMoney(n.gdp/n.pop*1000)+' والبطالة '+newsPct(n.unemployment)+'.']
};

function kingdomNewsStory(story,n,original){
 return S.kingdom&&Object.hasOwn(KINGDOM_NEWS,story.key)?KINGDOM_NEWS[story.key](n):original;
}

const KINGDOM_SHOCK_NEWS={
 'Investment cycle strengthens':['انتعاش الاستثمار','يدعم الاستثمار الجديد الطلب في الأشهر المقبلة.'],
 'Export orders rise':['زيادة طلبات التصدير','يدعم الطلب الخارجي القوي الإنتاج مؤقتاً.'],
 'A good harvest':['موسم زراعي جيد','المحصول القوي يخفف ضغط أسعار الغذاء.'],
 'Energy prices fall back':['انخفاض أسعار الطاقة','تراجع تكاليف الوقود يخفف الضغط على المصانع.'],
 'A productivity surprise':['ارتفاع الإنتاجية فوق المتوقع','تحسّن الناتج لكل ساعة عمل.'],
 'Energy costs climb':['ارتفاع تكلفة الطاقة','صدمة إمداد رفعت تكاليف الوقود والكهرباء. تخفف الطاقة النظيفة أثرها.'],
 'Credit conditions tighten':['تشدد الائتمان','يرجّح أن يتباطأ الاستثمار لنحو تسعة أشهر.'],
 'Supply chains seize up':['اضطراب سلاسل الإمداد','تعطّل الشحن ونقص المكوّنات يضغطان على الإنتاج.'],
 'A poor harvest':['تراجع المحصول','ارتفاع أسعار الغذاء يضغط على دخول الأسر.'],
 'Confidence drains away':['تراجع الثقة','تؤجّل الشركات والأسر بعض قرارات الإنفاق.'],
 'Construction picks up':['انتعاش الإنشاء','زادت أعمال الإسكان والبنية التحتية، ويستجيب التوظيف بتأخير.'],
 'Tourism has a record season':['موسم سياحي قوي','ارتفاع عدد الزوار يدعم وظائف الخدمات.'],
 'A technology upgrade lands':['تحديث المعدات الصناعية','تدخل معدات جديدة الخدمة في القطاع الصناعي.'],
 'Commodity terms of trade improve':['تحسّن شروط تجارة السلع','تحصل الصادرات على مقابل أعلى وتنخفض تكلفة الواردات.'],
 'Drought strains the interior':['الجفاف يضغط على المناطق الداخلية','نقص المياه يؤثر في الزراعة وتوليد الكهرباء.'],
 'A bank runs into trouble':['ضغوط على بنك محلي','تعرض أحد المقرضين الرئيسيين لضغوط مالية.'],
 'Industrial action spreads':['اتساع الإضراب الصناعي','توقفت أجزاء من الإنتاج نتيجة خلافات على الأجور.'],
 'An export market closes':['إغلاق سوق تصدير','يبحث المصدّرون عن بدائل بعد توقف مشترٍ رئيسي.']
};

function kingdomShockStory(title,body,n){
 if(!S.kingdom||!Object.hasOwn(KINGDOM_SHOCK_NEWS,title))return [title,body];
 const [headline,summary]=KINGDOM_SHOCK_NEWS[title];
 const context={
  'Energy costs climb':()=> 'مؤشر الطاقة النظيفة '+newsNumber(n.clean)+' من ١٠٠.',
  'Credit conditions tighten':()=> 'هامش الإقراض '+newsNumber(n.mon.spread)+' نقطة.',
  'A technology upgrade lands':()=> 'الإنفاق على البحث '+newsPct(n.policies.research)+' من الناتج.',
  'Commodity terms of trade improve':()=> 'الميزان التجاري '+kingdomMoney(n.exports-n.imports)+' شهرياً.',
  'A bank runs into trouble':()=> 'ضوابط الاستقرار المالي عند '+newsNumber(n.policies.macroprudential)+' من ١٠٠.',
  'Industrial action spreads':()=> 'بلغ التضخم '+newsPct(n.inflation)+'.'
 };
 return [headline,kingdomNationName(n)+' · '+summary+(context[title]?' '+context[title]():'')];
}

function kingdomFiveYearReview(n){
 return 'النمو '+newsPct(n.growth)+' والتضخم '+newsPct(n.inflation)+'. الناتج للفرد '
  +newsMoney(n.gdp/n.pop*1000)+' والبطالة '+newsPct(n.unemployment)+' والتأييد '+newsPct(n.approval)+'.';
}
