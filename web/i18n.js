/* Riyadh Metro Navigator — interface strings & editorial content
 * ---------------------------------------------------------------------------
 * Every user-facing string of the app lives here (8 interface languages plus
 * the Arabic/English passenger guide). Keeping it in one UMD module means the
 * copy can be reviewed, diffed and unit-tested without touching app logic:
 *
 *   browser → window.RMI18N      Node → require('./i18n')
 *
 * `t(key)` falls back en → ar → the key itself, so a partially translated
 * language still renders a complete interface.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMI18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* ------------------------------------------------------------------ i18n */
  var LANGS = {
    ar: { label: 'العربية', dir: 'rtl', names: 'ar' },
    en: { label: 'English', dir: 'ltr', names: 'en' },
    ur: { label: 'اردو', dir: 'rtl', names: 'ar' },
    hi: { label: 'हिन्दी', dir: 'ltr', names: 'en' },
    bn: { label: 'বাংলা', dir: 'ltr', names: 'en' },
    fil: { label: 'Filipino', dir: 'ltr', names: 'en' },
    fr: { label: 'Français', dir: 'ltr', names: 'en' },
    ru: { label: 'Русский', dir: 'ltr', names: 'en' }
  };
  var DOW = {
    ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ur: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
    hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
    fil: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  };
  var I18N = {
    ar: {
      'a11y.skip': 'تخطَّ إلى مخطط الرحلات',
      'nav.main': 'التنقل الرئيسي', 'nav.explore': 'استكشف الشبكة', 'nav.project': 'عن المشروع', 'nav.github': 'GitHub',
      'status.label': 'حالة تشغيل المترو', 'lang.label': 'لغة الواجهة', 'brand.aria': 'دليل مترو الرياض',
      'hero.artAria': 'رسم تخطيطي توضيحي لخطوط مترو الرياض الستة', 'metric.aria': 'إحصاءات شبكة مترو الرياض', 'modal.close': 'إغلاق النافذة',
      'hero.eyebrow': 'تنقّلٌ أذكى، في مدينة تتحرّك', 'hero.title1': 'الرياض،', 'hero.title2': 'وجهتك أقرب.',
      'hero.description': 'اكتشف شبكة المترو كاملة، اعثر على الطريق الأنسب، واعرف محطات التبديل قبل أن تغادر — كل ذلك في تجربة واحدة، بالعربية أو بلغتك.',
      'hero.plan': 'خطّط رحلتك', 'hero.explore': 'استكشف الشبكة', 'hero.firstRide': 'أول مرة؟ افتح دليل الركاب',
      'hero.searchKicker': 'ابدأ من هنا', 'hero.searchTitle': 'من أين إلى أين؟', 'hero.findRoute': 'اعثر على الطريق',
      'hero.estimateNote': 'الوقت تقديري — تفاصيل الرحلة تظهر في مساحة الشبكة',
      'plan.modeAria': 'طريقة اختيار المسار',
      'journey.emptyTitle': 'رحلتك ستظهر هنا', 'journey.emptyText': 'اختر نقطة الانطلاق والوصول من شريط البحث في الأعلى. سترى المحطات والتبديلات والوقت على المخطط نفسه.', 'journey.emptyAction': 'عدّل رحلتك',
      'hero.visualKicker': 'شبكة الرياض · عرض توضيحي', 'hero.visualTag': 'مخطط توضيحي للشبكة', 'hero.visualPlace': 'الرياض، المملكة العربية السعودية',
      'hero.floatTitle': 'شبكة واحدة، 6 مسارات', 'hero.floatBody': 'من المطار إلى قلب المدينة', 'hero.floatKm': 'كم من المسارات', 'hero.floatUpdated': 'شبكة مترو الرياض',
      'metric.lines': 'مسارات', 'metric.linesSub': 'تربط أنحاء المدينة', 'metric.stations': 'محطة', 'metric.stationsSub': 'على امتداد الشبكة',
      'metric.km': 'كم', 'metric.kmSub': 'من المسارات المرسومة', 'metric.languages': 'لغات', 'metric.languagesSub': 'لتجربة أقرب للجميع',
      'workspace.eyebrow': 'خريطتك إلى المدينة', 'workspace.title1': 'كل الشبكة.', 'workspace.title2': 'رحلة واحدة واضحة.',
      'workspace.description': 'اختر محطتيك أو ابحث عن وجهتك. سنرتّب لك المسار والتبديلات والوقت التقديري — ثم استكشفه على المخطط أو الخريطة.',
      'workspace.community': 'مشروع مجتمعي مفتوح المصدر', 'workspace.network': '6 مسارات · 83 محطة',
      'workspace.disclaimer': 'أوقات الرحلات والأسعار إرشادية وقد تتغيّر. تأكّد من آخر المعلومات في تطبيق درب الرسمي.',
      'panel.aria': 'أدوات مترو الرياض', 'panel.toggle': 'إظهار أو إخفاء أدوات الرحلة', 'panel.eyebrow': 'مساحة التنقّل', 'panel.title': 'مخطّط رحلتك', 'tabs.aria': 'أدوات استكشاف المترو',
      'planner.heading': 'من أين تبدأ؟', 'planner.subheading': 'اكتب محطة أو مكاناً في الرياض',
      'plan.fromAria': 'محطة الانطلاق أو المكان', 'plan.toAria': 'محطة الوصول أو المكان',
      'plan.fromSuggestAria': 'اقتراحات نقطة الانطلاق', 'plan.toSuggestAria': 'اقتراحات نقطة الوصول', 'legend.aria': 'دليل ألوان المسارات والمحطات',
      'stage.aria': 'مخطط مترو الرياض التفاعلي', 'stage.kicker': 'استكشف من حولك', 'stage.title': 'شبكة مترو الرياض',
      'map.region': 'الخريطة الجغرافية لمسارات المترو', 'diagram.region': 'المخطط التخطيطي التفاعلي',
      'view.aria': 'اختيار طريقة عرض الشبكة', 'map.toolbar': 'أدوات الخريطة',
      'project.eyebrow': 'مبني للمدينة، ومفتوح للجميع', 'project.title1': 'أكثر من خريطة.', 'project.title2': 'رفيقٌ لكل رحلة.',
      'project.description': 'من البيانات المفتوحة إلى قرار الركوب، جمعنا الأدوات التي تحتاجها في تجربة واحدة: واضحة للمسافر، ومفيدة للمطور، وقابلة للتحقق والمساهمة.',
      'project.github': 'استكشف المشروع على GitHub',
      'feature.routeTitle': 'من الباب إلى المحطة', 'feature.routeBody': 'قارن المسارات والتبديلات، ابحث بالمعالم، واعرف وقت الرحلة التقريبي قبل الانطلاق.', 'feature.routeAction': 'خطّط الآن',
      'feature.networkTitle': 'الشبكة بكل تفاصيلها', 'feature.networkBody': 'استكشف ترتيب المحطات، نقاط التبادل، المسارات الجغرافية والوجهات القريبة.', 'feature.networkAction': 'تصفّح المسارات',
      'feature.dataTitle': 'بيانات تقدر تثق بها', 'feature.dataBody': 'حمّل بيانات الشبكة بصيغ مفتوحة، وراجع مصادرها وافتراضاتها بكل شفافية.', 'feature.dataAction': 'افتح مركز البيانات',
      'project.notice': 'مشروع مجتمعي مستقل وغير رسمي، غير تابع للهيئة الملكية لمدينة الرياض أو مشغّل المترو. بيانات الرحلات والأجرة إرشادية وليست بديلاً عن القنوات الرسمية.',
      'project.sources': 'مصادر البيانات ↗', 'footer.tagline': 'افهم الشبكة. اختر طريقك. تحرّك بثقة.', 'footer.license': 'مشروع مفتوح المصدر · MIT',
      'app.title': 'مترو الرياض — دليل التنقل',
      'app.subtitle': 'Riyadh Metro Navigator · 6 مسارات · 83 محطة',
      'top.kmz': '⬇ KMZ لـ Google Earth',
      'tab.plan': '🧭 خطّط رحلتك', 'tab.lines': '🚇 المسارات', 'tab.guide': '📖 دليل الركاب', 'tab.info': 'ℹ️ معلومات', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'من', 'plan.to': 'إلى', 'plan.search': 'محطة أو مكان: العليا، برج المملكة، المطار…',
      'plan.locate': 'أقرب محطة لموقعي', 'plan.swap': 'تبديل', 'plan.clear': 'مسح',
      'plan.leaveAt': '🕒 المغادرة', 'plan.now': 'الآن',
      'plan.fastest': '⚡ الأسرع', 'plan.fewest': '🔁 أقل تبديل', 'plan.go': 'عرض المسار', 'plan.new': 'رحلة جديدة',
      'plan.hint': 'اكتب اسم محطة أو مكان (تُقبل الأسماء القديمة مثل «العليا»)، أو انقر على محطتين في المخطط. الأزمنة تقديرية.',
      'plan.popular': 'رحلات شائعة',
      'view.map': '🗺️ الخريطة', 'view.diagram': '🚇 المخطط', 'view.gmaps': '🌐 خريطة Google',
      'status.open': 'المترو يعمل الآن · حتى {t}', 'status.closed': 'المترو مغلق الآن · يفتح {t}', 'status.closedDay': 'المترو مغلق الآن · يفتح {d} {t}',
      'lines.hint': 'فعّل/أخفِ المسارات على الخريطة، وافتح أي مسار لعرض محطاته بالترتيب. المحطات ذات الإطار الأسود هي محطات تبادل.',
      'map.basemap': 'تغيير الخلفية', 'map.fit': 'عرض الشبكة كاملة', 'map.clear': 'مسح المسار',
      'panel.open': 'اضغط لفتح اللوحة',
      'err.pick': 'اختر محطة البداية ومحطة الوصول.', 'err.same': 'محطة البداية هي نفسها محطة الوصول.',
      'err.samePlace': 'المكانان يتبعان المحطة نفسها ({s}) — المسافة بينهما تُقطع مشياً.',
      'err.unknown': 'لم أتعرف على المحطة أو المكان: ',
      'res.title': 'الرحلة المقترحة', 'res.min': 'دقيقة', 'res.stops': 'محطة', 'res.transfers': 'تبديل', 'res.none': 'بدون تبديل',
      'res.distance': 'المسافة', 'res.fare': 'التذكرة', 'res.firstClass': 'الدرجة الأولى', 'res.standard': 'عادي', 'res.sar': 'ريال',
      'res.depart': 'المغادرة', 'res.arrive': 'الوصول', 'res.wait': 'يشمل ~{n} د انتظار القطار',
      'res.est': 'الأزمنة تقديرية (سرعة متوسطة + توقف ~50 ث لكل محطة + زمن التبديل). ساعات الخدمة: {h} — تحقّق من تطبيق درب.',
      'res.board': 'اركب', 'res.towards': 'باتجاه', 'res.alight': 'انزل في', 'res.change': 'بدّل إلى', 'res.transferTime': 'زمن التبديل التقديري',
      'res.showStops': 'عرض المحطات على الطريق', 'res.start': 'البداية', 'res.end': 'الوصول',
      'res.walkFrom': 'امشِ {d} (~{n} د) من {p} إلى محطة {s}', 'res.walkTo': 'ثم امشِ {d} (~{n} د) إلى {p}',
      'res.gmaps': 'افتح في خرائط Google (مواصلات)', 'res.kml': 'تنزيل KML للرحلة', 'res.geojson': 'GeoJSON', 'res.share': 'نسخ رابط الرحلة', 'res.earth': 'Google Earth',
      'res.alt.fastest': '⚡ الأسرع', 'res.alt.fewest': '🔁 أقل تبديل',
      'warn.closed': 'المترو لا يعمل في وقت المغادرة المختار — الأوقات أدناه محسوبة من أول قطار الساعة {t}.',
      'warn.late': 'الوصول المتوقع بعد انتهاء الخدمة ({t}) — غادر مبكراً أو تحقّق من موعد آخر قطار.',
      'warn.tight': 'ستصل قبل انتهاء الخدمة ({t}) بقليل — قد يغادر آخر قطار في اتجاهك مبكراً.',
      'sch.pickA': 'انقر على محطة الانطلاق (A) في المخطط', 'sch.pickB': 'A: {s} — الآن انقر على محطة الوصول (B)',
      'sch.tapHint': 'انقر على محطتين في المخطط لتخطيط رحلة', 'sch.cancel': 'إلغاء',
      'st.lines': 'المسارات', 'st.interchange': 'محطة تبادل', 'st.bus': 'محور حافلات', 'st.pr': 'مواقف اركن واركب',
      'st.prev': 'المحطة السابقة', 'st.next': 'المحطة التالية', 'st.terminus': 'نهاية المسار',
      'st.fromHere': 'من هنا', 'st.toHere': 'إلى هنا', 'st.gmaps': 'خرائط Google', 'st.dir': 'اتجاهات المشي إلى المحطة',
      'st.earth': 'Google Earth', 'st.geo': 'تطبيق الخرائط', 'st.copy': 'نسخ الإحداثيات', 'st.copied': 'تم النسخ ✓', 'st.share': 'نسخ رابط المحطة',
      'st.aka': 'يُعرف أيضاً بـ', 'st.nearby': 'أماكن قريبة',
      'struct.elevated': 'مرتفعة (جسر)', 'struct.deep_underground': 'نفقية عميقة', 'struct.shallow_underground': 'نفقية سطحية', 'struct.at_grade': 'على مستوى الأرض',
      'near.title': 'أقرب المحطات إليك', 'near.walk': 'مشياً', 'near.use': 'ابدأ من هنا', 'near.err': 'تعذّر تحديد موقعك. تأكد من السماح بالوصول إلى الموقع.',
      'near.far': 'أنت بعيد عن الشبكة ({d}) — أقرب محطة:', 'near.dir': 'اتجاهات المشي',
      'place.near': 'أقرب محطة', 'place.approx': 'موقع تقريبي',
      'line.stations': 'محطة', 'line.km': 'كم', 'line.opened': 'افتُتح',
      'km': 'كم', 'm': 'م', 'min': 'د',
      'toast.copied': 'تم نسخ الرابط ✓', 'toast.kml': 'تم تنزيل ملف KML — افتحه في Google Earth',
      'base.map': 'خريطة', 'base.light': 'فاتحة', 'base.sat': 'قمر صناعي',
      'legend.x': 'محطة تبادل',
      'info.hours': '🕒 ساعات التشغيل', 'info.fares': '🎫 التذاكر والأسعار', 'info.ticket': 'التذكرة', 'info.standard': 'عادي', 'info.first': 'الدرجة الأولى',
      'info.tips': '💡 نصائح', 'info.destinations': '📍 وجهات شائعة وأقرب محطة لها', 'info.about': 'ℹ️ عن المشروع', 'info.support': 'الدعم',
      'info.aboutText': 'مشروع مجتمعي مفتوح المصدر وغير رسمي، لا يتبع الهيئة الملكية لمدينة الرياض أو مشغّل المترو. يجمع بين خريطة جغرافية دقيقة لمسارات المترو (للاستيراد في Google Earth وخرائط Google)، ومخطط تخطيطي للشبكة، ومخطِّط رحلات يعمل بالكامل داخل المتصفح. إحداثيات المحطات ومسارات الخطوط من بيانات المسارات المفتوحة للنقل العام بالرياض؛ الأوقات والأسعار معلومات عامة قد تتغير؛ مواقع الأماكن تقريبية الغرض منها اختيار المحطة المناسبة فقط.',
      'info.credits': 'استُلهمت تجربة الاستخدام (المخطط التفاعلي، اختيار المحطتين بالنقر، الروابط القصيرة، ساعات العمل والأسعار) من مشاريع مجتمعية مثل riyadhmetro.fyi — مع بيانات وشيفرة ورسوم مستقلة بالكامل.',
      'track.btn': 'تتبع مباشر عبر GPS', 'track.err': 'تعذّر الوصول إلى موقعك — اسمح بالوصول إلى الموقع من إعدادات المتصفح.',
      'track.started': 'التتبع المباشر مفعّل 📍', 'track.stopped': 'تم إيقاف التتبع المباشر',
      'track.live': '📍 أنت الآن هنا — تتبع مباشر', 'track.acc': 'دقة الموقع ~{n} م',
      'track.nearestTitle': 'أقرب محطة إليك الآن — اركب منها', 'track.board': 'اركب من هنا',
      'track.setDest': 'الآن اختر وجهتك في الأعلى ↑ وسيُحسب المسار من أقرب محطة إليك.',
      'track.trip': '🚆 رحلتك المباشرة', 'track.at': 'أنت قرب محطة «{s}»',
      'track.remain': 'المتبقي: {n} محطة حتى «{s}»', 'track.toEnd': '{d} حتى وجهتك',
      'track.prepAlight': '🔔 استعد للنزول — محطتك «{s}» على بُعد {d}',
      'track.arrived': '🎉 وصلت إلى «{s}» — لا تنسَ تمرير البطاقة عند بوابة الخروج',
      'track.prepTransfer': '🔁 استعد للتبديل في «{s}» إلى {line} — على بُعد {d}',
      'track.info': '📍 أقرب محطة على رحلتك: «{s}» · المتبقي {n} محطة',
      'info.whyTitle': '🆚 لماذا هذا المشروع إذا كانت خرائط جوجل تعرض المترو؟',
      'info.whyText': '<ul><li>جوجل يعطيك <b>اتجاهاً فقط</b>؛ هنا تحصل على الشبكة كلها <b>ملفات مفتوحة</b>: KMZ لـ Google Earth مع جولات طيران افتراضية، وKML وGeoJSON وGPX وCSV لأي تطبيق أو تحليل.</li><li><b>مخطط شبكة تفاعلي وقابل للطباعة</b> — لا يوجد له مكافئ في خرائط جوجل.</li><li>تفاصيل تبديل دقيقة لكل محطة: 7 دقائق في المركز المالي، دقيقتان على الجذع المشترك للأصفر/البنفسجي — جوجل يعرض أزمنة عامة.</li><li><b>الأجرة وساعات التشغيل والدرجة الأولى</b> داخل نتيجة الرحلة نفسها، مع تحذيرات «آخر قطار» و«المترو مغلق» بتوقيت الرياض.</li><li>بحث بالأسماء القديمة والشائعة («العليا» ← stc، «برج المملكة» ← العروبة) وبالوجهات مع مسافة المشي من كل مكان.</li><li><b>دليل الركاب</b>: المخالفات والغرامات والممنوعات وخطوات أول رحلة — غير موجودة في خرائط جوجل.</li><li>يعمل <b>دون اتصال</b> ودون مفاتيح API أو حساب، مع روابط قصيرة لمشاركة أي رحلة أو محطة.</li><li>مشروع <b>مفتوح المصدر</b> يمكنك تعديله والمساهمة فيه — بيانات جوجل صندوق مغلق.</li></ul>',
      'theme.toggle': 'الوضع الداكن',
      'fv.title': '🚇 أول مرة تركب مترو الرياض؟',
      'fv.sub': 'هذه أكثر خمسة أخطاء يقع فيها الركاب الجدد — دقيقة واحدة توفّر عليك الغرامات والحيرة:',
      'fv.open': '📖 افتح دليل الركاب الكامل', 'fv.dismiss': 'تمام، فهمت ✓'
    },
    en: {
      'a11y.skip': 'Skip to the journey planner',
      'nav.main': 'Main navigation', 'nav.explore': 'Explore the network', 'nav.project': 'About the project', 'nav.github': 'GitHub',
      'status.label': 'Metro service status', 'lang.label': 'Interface language', 'brand.aria': 'Riyadh Metro Navigator home',
      'hero.artAria': 'Illustrative diagram of the six Riyadh Metro lines', 'metric.aria': 'Riyadh Metro network statistics', 'modal.close': 'Close dialog',
      'hero.eyebrow': 'A smarter way to move through the city', 'hero.title1': 'Riyadh,', 'hero.title2': 'within reach.',
      'hero.description': 'Explore the full metro network, find a better route and know where to transfer before you leave — all in one experience, in Arabic or your language.',
      'hero.plan': 'Plan your journey', 'hero.explore': 'Explore the network', 'hero.firstRide': 'First ride? Open the rider guide',
      'hero.searchKicker': 'START HERE', 'hero.searchTitle': 'Where to?', 'hero.findRoute': 'Find my route',
      'hero.estimateNote': 'Times are estimates — route details appear in the network workspace',
      'plan.modeAria': 'Choose how to optimise the route',
      'journey.emptyTitle': 'Your journey will appear here', 'journey.emptyText': 'Choose an origin and destination in the search above. Stops, transfers and estimated time will appear alongside the network.', 'journey.emptyAction': 'Edit your journey',
      'hero.visualKicker': 'RIYADH NETWORK · ILLUSTRATIVE VIEW', 'hero.visualTag': 'Illustrative network diagram', 'hero.visualPlace': 'Riyadh, Saudi Arabia',
      'hero.floatTitle': 'One network, six lines', 'hero.floatBody': 'From the airport to the city centre', 'hero.floatKm': 'kilometres of rail', 'hero.floatUpdated': 'Riyadh Metro network',
      'metric.lines': 'lines', 'metric.linesSub': 'across the city', 'metric.stations': 'stations', 'metric.stationsSub': 'across the network',
      'metric.km': 'km', 'metric.kmSub': 'of mapped rail', 'metric.languages': 'languages', 'metric.languagesSub': 'designed for everyone',
      'workspace.eyebrow': 'Your map to the city', 'workspace.title1': 'The whole network.', 'workspace.title2': 'One clear journey.',
      'workspace.description': 'Choose two stations or search for a destination. Compare routes, transfers and estimated journey times — then explore them on the diagram or map.',
      'workspace.community': 'Open community project', 'workspace.network': '6 lines · 83 stations',
      'workspace.disclaimer': 'Journey times and fares are indicative and may change. Check the official darb app for the latest information.',
      'panel.aria': 'Riyadh Metro tools', 'panel.toggle': 'Show or hide journey tools', 'panel.eyebrow': 'Your trip workspace', 'panel.title': 'Journey planner', 'tabs.aria': 'Metro discovery tools',
      'planner.heading': 'Where are you going?', 'planner.subheading': 'Search a station or a place in Riyadh',
      'plan.fromAria': 'Origin station or place', 'plan.toAria': 'Destination station or place',
      'plan.fromSuggestAria': 'Origin suggestions', 'plan.toSuggestAria': 'Destination suggestions', 'legend.aria': 'Line and station colour legend',
      'stage.aria': 'Interactive Riyadh Metro network', 'stage.kicker': 'Explore your city', 'stage.title': 'Riyadh Metro network',
      'map.region': 'Geographic map of the metro lines', 'diagram.region': 'Interactive schematic network diagram',
      'view.aria': 'Choose a network view', 'map.toolbar': 'Map tools',
      'project.eyebrow': 'Built for the city. Open to everyone.', 'project.title1': 'More than a map.', 'project.title2': 'A companion for every trip.',
      'project.description': 'From open data to the moment you board, the tools you need are together in one place: clear for riders, useful for developers and open to review and contribution.',
      'project.github': 'Explore the project on GitHub',
      'feature.routeTitle': 'Door to station', 'feature.routeBody': 'Compare routes and transfers, search landmarks and get an estimated journey time before you go.', 'feature.routeAction': 'Plan a trip',
      'feature.networkTitle': 'The network, in detail', 'feature.networkBody': 'Explore station order, interchange points, geographic routes and nearby destinations.', 'feature.networkAction': 'Browse the lines',
      'feature.dataTitle': 'Data you can inspect', 'feature.dataBody': 'Download network data in open formats and review its sources and assumptions transparently.', 'feature.dataAction': 'Open data centre',
      'project.notice': 'Independent, unofficial community project; not affiliated with the Royal Commission for Riyadh City or the metro operator. Journey and fare information is indicative, not a substitute for official channels.',
      'project.sources': 'Data sources ↗', 'footer.tagline': 'Know the network. Find your way. Move with confidence.', 'footer.license': 'Open-source community project · MIT',
      'app.title': 'Riyadh Metro Navigator',
      'app.subtitle': 'مترو الرياض · 6 lines · 83 stations',
      'top.kmz': '⬇ KMZ for Google Earth',
      'tab.plan': '🧭 Plan a trip', 'tab.lines': '🚇 Lines', 'tab.guide': '📖 Rider guide', 'tab.info': 'ℹ️ Info', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'From', 'plan.to': 'To', 'plan.search': 'Station or place: Olaya, Kingdom Centre, airport…',
      'plan.locate': 'Nearest station to me', 'plan.swap': 'Swap', 'plan.clear': 'Clear',
      'plan.leaveAt': '🕒 Leave at', 'plan.now': 'Now',
      'plan.fastest': '⚡ Fastest', 'plan.fewest': '🔁 Fewest transfers', 'plan.go': 'Show route', 'plan.new': 'New trip',
      'plan.hint': 'Type a station or a place (old names such as “Olaya” work too), or tap two stations on the diagram. Times are estimates.',
      'plan.popular': 'Popular trips',
      'view.map': '🗺️ Map', 'view.diagram': '🚇 Diagram', 'view.gmaps': '🌐 Google Maps',
      'status.open': 'Metro running · until {t}', 'status.closed': 'Metro closed · opens {t}', 'status.closedDay': 'Metro closed · opens {d} {t}',
      'lines.hint': 'Toggle lines on the map and expand a line to see its stations in order. Stations with a black ring are interchanges.',
      'map.basemap': 'Change basemap', 'map.fit': 'Show whole network', 'map.clear': 'Clear route',
      'panel.open': 'Tap to open the panel',
      'err.pick': 'Choose an origin and a destination.', 'err.same': 'Origin and destination are the same station.',
      'err.samePlace': 'Both places are served by the same station ({s}) — it is a walk between them.',
      'err.unknown': 'Unknown station or place: ',
      'res.title': 'Suggested journey', 'res.min': 'min', 'res.stops': 'stops', 'res.transfers': 'transfers', 'res.none': 'no transfers',
      'res.distance': 'Distance', 'res.fare': 'Ticket', 'res.firstClass': 'First class', 'res.standard': 'Standard', 'res.sar': 'SAR',
      'res.depart': 'Depart', 'res.arrive': 'Arrive', 'res.wait': 'includes ~{n} min waiting for the train',
      'res.est': 'Times are estimates (average speed + ~50 s dwell per station + transfer time). Service hours: {h} — check the darb app.',
      'res.board': 'Board the', 'res.towards': 'towards', 'res.alight': 'Alight at', 'res.change': 'Change to the', 'res.transferTime': 'estimated transfer time',
      'res.showStops': 'Show stations en route', 'res.start': 'Start', 'res.end': 'Arrive',
      'res.walkFrom': 'Walk {d} (~{n} min) from {p} to {s} station', 'res.walkTo': 'Then walk {d} (~{n} min) to {p}',
      'res.gmaps': 'Open in Google Maps (transit)', 'res.kml': 'Download route KML', 'res.geojson': 'GeoJSON', 'res.share': 'Copy trip link', 'res.earth': 'Google Earth',
      'res.alt.fastest': '⚡ Fastest', 'res.alt.fewest': '🔁 Fewest transfers',
      'warn.closed': 'The metro is not running at the chosen departure time — times below are counted from the first train at {t}.',
      'warn.late': 'Expected arrival is after the end of service ({t}) — leave earlier or check the last train.',
      'warn.tight': 'You arrive shortly before the end of service ({t}) — the last train in your direction may leave earlier.',
      'sch.pickA': 'Tap your origin station (A) on the diagram', 'sch.pickB': 'A: {s} — now tap the destination (B)',
      'sch.tapHint': 'Tap two stations on the diagram to plan a trip', 'sch.cancel': 'Cancel',
      'st.lines': 'Lines', 'st.interchange': 'Interchange station', 'st.bus': 'Bus hub', 'st.pr': 'Park & Ride',
      'st.prev': 'Previous station', 'st.next': 'Next station', 'st.terminus': 'End of line',
      'st.fromHere': 'From here', 'st.toHere': 'To here', 'st.gmaps': 'Google Maps', 'st.dir': 'Walking directions to station',
      'st.earth': 'Google Earth', 'st.geo': 'Maps app', 'st.copy': 'Copy coordinates', 'st.copied': 'Copied ✓', 'st.share': 'Copy station link',
      'st.aka': 'Also known as', 'st.nearby': 'Nearby places',
      'struct.elevated': 'Elevated', 'struct.deep_underground': 'Deep underground', 'struct.shallow_underground': 'Shallow underground', 'struct.at_grade': 'At grade',
      'near.title': 'Nearest stations to you', 'near.walk': 'walk', 'near.use': 'Start here', 'near.err': 'Could not get your location. Please allow location access.',
      'near.far': 'You are far from the network ({d}) — nearest station:', 'near.dir': 'Walking directions',
      'place.near': 'Nearest station', 'place.approx': 'approximate location',
      'line.stations': 'stations', 'line.km': 'km', 'line.opened': 'opened',
      'km': 'km', 'm': 'm', 'min': 'min',
      'toast.copied': 'Link copied ✓', 'toast.kml': 'KML downloaded — open it in Google Earth',
      'base.map': 'Map', 'base.light': 'Light', 'base.sat': 'Satellite',
      'legend.x': 'Interchange',
      'info.hours': '🕒 Operating hours', 'info.fares': '🎫 Tickets & fares', 'info.ticket': 'Ticket', 'info.standard': 'Standard', 'info.first': 'First class',
      'info.tips': '💡 Tips', 'info.destinations': '📍 Popular destinations and their nearest station', 'info.about': 'ℹ️ About', 'info.support': 'Support',
      'info.aboutText': 'An unofficial, open-source community project — not affiliated with the Royal Commission for Riyadh City or the metro operator. It combines an accurate geographic map of the metro alignments (importable into Google Earth and Google Maps), a schematic network diagram and a journey planner that runs entirely in your browser. Station coordinates and alignments come from Riyadh public-transport open route data; hours and fares are public information that may change; place locations are approximate and only meant to pick the right station.',
      'info.credits': 'The user experience (interactive diagram, tap-to-plan, short links, hours & fares) is inspired by community projects such as riyadhmetro.fyi — with fully independent data, code and artwork.',
      'track.btn': 'Live GPS tracking', 'track.err': 'Could not access your location — please allow location access in your browser settings.',
      'track.started': 'Live tracking on 📍', 'track.stopped': 'Live tracking stopped',
      'track.live': '📍 You are here — live tracking', 'track.acc': 'accuracy ~{n} m',
      'track.nearestTitle': 'Nearest station to you right now — board from it', 'track.board': 'Board here',
      'track.setDest': 'Now choose your destination above ↑ and the route will start from your nearest station.',
      'track.trip': '🚆 Your live trip', 'track.at': 'You are near {s} station',
      'track.remain': '{n} stops left to {s}', 'track.toEnd': '{d} to your destination',
      'track.prepAlight': '🔔 Get ready to alight — your station {s} is {d} away',
      'track.arrived': '🎉 You have arrived at {s} — remember to tap out at the exit gate',
      'track.prepTransfer': '🔁 Get ready to change at {s} to {line} — {d} away',
      'track.info': '📍 Nearest station on your trip: {s} · {n} stops left',
      'info.whyTitle': '🆚 Why use this project when Google Maps shows the metro?',
      'info.whyText': '<ul><li>Google gives you <b>directions only</b>; here you get the whole network as <b>open files</b>: a KMZ for Google Earth with fly-over tours, plus KML, GeoJSON, GPX and CSV for any app or analysis.</li><li>An <b>interactive, printable network diagram</b> — nothing like it in Google Maps.</li><li>Station-accurate transfer details: 7 minutes at KAFD, 2 minutes on the shared Yellow/Purple trunk — Google shows generic times.</li><li><b>Fares, service hours and first-class details</b> inside the journey result itself, with “last train” and “metro closed” warnings in Riyadh time.</li><li>Search by old and common names (“Olaya” → stc, “Kingdom Centre” → Al Urubah) and by destinations with walking distances.</li><li>A <b>rider guide</b>: violations and fines, prohibited items and first-ride steps — not available in Google Maps.</li><li>Works <b>offline</b>, with no API keys and no account, and short links to share any trip or station.</li><li>An <b>open-source</b> project you can fix and contribute to — Google’s data is a closed box.</li></ul>',
      'theme.toggle': 'Dark mode',
      'fv.title': '🚇 First time on the Riyadh Metro?',
      'fv.sub': 'The five most common first-ride mistakes — one minute saves you fines and confusion:',
      'fv.open': '📖 Open the full rider guide', 'fv.dismiss': 'Got it ✓'
    },
    ur: {
      'app.title': 'ریاض میٹرو — سفر گائیڈ',
      'tab.plan': '🧭 سفر کی منصوبہ بندی', 'tab.lines': '🚇 لائنیں', 'tab.guide': '📖 مسافر گائیڈ', 'tab.info': 'ℹ️ معلومات', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'کہاں سے', 'plan.to': 'کہاں تک', 'plan.search': 'اسٹیشن یا جگہ تلاش کریں…', 'plan.leaveAt': '🕒 روانگی', 'plan.now': 'ابھی',
      'plan.fastest': '⚡ تیز ترین', 'plan.fewest': '🔁 کم تبدیلی', 'plan.go': 'راستہ دکھائیں', 'plan.new': 'نیا سفر', 'plan.locate': 'میرے قریب ترین اسٹیشن',
      'plan.hint': 'اسٹیشن یا جگہ کا نام لکھیں، یا ڈایاگرام پر دو اسٹیشنوں پر ٹیپ کریں۔ اوقات تخمینی ہیں۔', 'plan.popular': 'مقبول سفر',
      'view.map': '🗺️ نقشہ', 'view.diagram': '🚇 ڈایاگرام', 'view.gmaps': '🌐 گوگل میپس',
      'status.open': 'میٹرو چل رہی ہے · {t} تک', 'status.closed': 'میٹرو بند ہے · {t} بجے کھلے گی', 'status.closedDay': 'میٹرو بند ہے · {d} {t} کھلے گی',
      'err.pick': 'روانگی اور منزل کا اسٹیشن منتخب کریں۔', 'err.same': 'روانگی اور منزل ایک ہی اسٹیشن ہیں۔', 'err.unknown': 'نامعلوم اسٹیشن یا جگہ: ',
      'res.title': 'تجویز کردہ سفر', 'res.min': 'منٹ', 'res.stops': 'اسٹیشن', 'res.transfers': 'تبدیلی', 'res.none': 'بغیر تبدیلی', 'res.distance': 'فاصلہ', 'res.fare': 'ٹکٹ',
      'res.firstClass': 'فرسٹ کلاس', 'res.standard': 'عام', 'res.sar': 'ریال', 'res.depart': 'روانگی', 'res.arrive': 'آمد', 'res.wait': 'ٹرین کے انتظار کے ~{n} منٹ شامل',
      'res.est': 'اوقات تخمینی ہیں۔ سروس: {h} — darb ایپ میں تصدیق کریں۔',
      'res.board': 'سوار ہوں', 'res.towards': 'بجانب', 'res.alight': 'اتریں', 'res.change': 'تبدیل کریں', 'res.transferTime': 'تبدیلی کا تخمینی وقت',
      'res.showStops': 'راستے کے اسٹیشن دکھائیں', 'res.start': 'آغاز', 'res.end': 'منزل', 'res.gmaps': 'Google Maps میں کھولیں', 'res.share': 'سفر کا لنک کاپی کریں',
      'res.walkFrom': '{p} سے {s} اسٹیشن تک {d} پیدل (~{n} منٹ)', 'res.walkTo': 'پھر {p} تک {d} پیدل (~{n} منٹ)',
      'warn.closed': 'منتخب وقت پر میٹرو بند ہے — اوقات پہلی ٹرین ({t}) سے شمار کیے گئے ہیں۔', 'warn.late': 'متوقع آمد سروس ختم ہونے ({t}) کے بعد ہے — جلدی روانہ ہوں۔',
      'warn.tight': 'آپ سروس ختم ہونے ({t}) سے تھوڑا پہلے پہنچیں گے — آخری ٹرین جلدی جا سکتی ہے۔',
      'sch.pickA': 'ڈایاگرام پر روانگی کے اسٹیشن (A) پر ٹیپ کریں', 'sch.pickB': 'A: {s} — اب منزل (B) پر ٹیپ کریں', 'sch.tapHint': 'سفر کے لیے دو اسٹیشنوں پر ٹیپ کریں', 'sch.cancel': 'منسوخ',
      'st.fromHere': 'یہاں سے', 'st.toHere': 'یہاں تک', 'st.interchange': 'تبادلہ اسٹیشن', 'st.lines': 'لائنیں',
      'near.title': 'آپ کے قریب ترین اسٹیشن', 'near.walk': 'پیدل', 'near.use': 'یہاں سے شروع', 'near.err': 'آپ کا مقام معلوم نہ ہو سکا۔',
      'info.hours': '🕒 اوقاتِ کار', 'info.fares': '🎫 ٹکٹ اور کرایہ', 'info.about': 'ℹ️ اس پروجیکٹ کے بارے میں', 'info.tips': '💡 مشورے', 'info.destinations': '📍 منزلیں اور قریب ترین اسٹیشن',
      'info.ticket': 'ٹکٹ', 'info.standard': 'عام', 'info.first': 'فرسٹ کلاس',
      'place.near': 'قریب ترین اسٹیشن', 'min': 'منٹ', 'km': 'کلومیٹر', 'm': 'میٹر', 'legend.x': 'تبادلہ', 'map.fit': 'پورا نیٹ ورک', 'map.clear': 'راستہ صاف کریں',
      'toast.copied': 'لنک کاپی ہو گیا ✓', 'line.stations': 'اسٹیشن'
    },
    hi: {
      'app.title': 'रियाद मेट्रो — यात्रा गाइड',
      'tab.plan': '🧭 यात्रा योजना', 'tab.lines': '🚇 लाइनें', 'tab.guide': '📖 यात्री गाइड', 'tab.info': 'ℹ️ जानकारी', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'कहाँ से', 'plan.to': 'कहाँ तक', 'plan.search': 'स्टेशन या जगह खोजें…', 'plan.leaveAt': '🕒 प्रस्थान', 'plan.now': 'अभी',
      'plan.fastest': '⚡ सबसे तेज़', 'plan.fewest': '🔁 कम बदलाव', 'plan.go': 'रास्ता दिखाएँ', 'plan.new': 'नई यात्रा', 'plan.locate': 'मेरे पास का स्टेशन',
      'plan.hint': 'स्टेशन या जगह का नाम लिखें, या डायग्राम पर दो स्टेशन टैप करें। समय अनुमानित हैं।', 'plan.popular': 'लोकप्रिय यात्राएँ',
      'view.map': '🗺️ नक्शा', 'view.diagram': '🚇 डायग्राम', 'view.gmaps': '🌐 गूगल मैप्स',
      'status.open': 'मेट्रो चालू है · {t} तक', 'status.closed': 'मेट्रो बंद है · {t} बजे खुलेगी', 'status.closedDay': 'मेट्रो बंद है · {d} {t} खुलेगी',
      'err.pick': 'प्रस्थान और गंतव्य स्टेशन चुनें।', 'err.same': 'प्रस्थान और गंतव्य एक ही स्टेशन हैं।', 'err.unknown': 'अज्ञात स्टेशन या जगह: ',
      'res.title': 'सुझाई गई यात्रा', 'res.min': 'मिनट', 'res.stops': 'स्टेशन', 'res.transfers': 'बदलाव', 'res.none': 'बिना बदलाव', 'res.distance': 'दूरी', 'res.fare': 'टिकट',
      'res.firstClass': 'फ़र्स्ट क्लास', 'res.standard': 'सामान्य', 'res.sar': 'रियाल', 'res.depart': 'प्रस्थान', 'res.arrive': 'आगमन', 'res.wait': 'ट्रेन की ~{n} मिनट प्रतीक्षा शामिल',
      'res.est': 'समय अनुमानित हैं। सेवा: {h} — darb ऐप में पुष्टि करें।',
      'res.board': 'चढ़ें', 'res.towards': 'की ओर', 'res.alight': 'उतरें', 'res.change': 'बदलें', 'res.transferTime': 'अनुमानित बदलाव समय',
      'res.showStops': 'रास्ते के स्टेशन दिखाएँ', 'res.start': 'शुरुआत', 'res.end': 'गंतव्य', 'res.gmaps': 'Google Maps में खोलें', 'res.share': 'यात्रा लिंक कॉपी करें',
      'res.walkFrom': '{p} से {s} स्टेशन तक {d} पैदल (~{n} मिनट)', 'res.walkTo': 'फिर {p} तक {d} पैदल (~{n} मिनट)',
      'warn.closed': 'चुने गए समय पर मेट्रो बंद है — समय पहली ट्रेन ({t}) से गिना गया है।', 'warn.late': 'अनुमानित आगमन सेवा समाप्त होने ({t}) के बाद है — जल्दी निकलें।',
      'warn.tight': 'आप सेवा समाप्त होने ({t}) से थोड़ा पहले पहुँचेंगे — आख़िरी ट्रेन जल्दी जा सकती है।',
      'sch.pickA': 'डायग्राम पर प्रस्थान स्टेशन (A) टैप करें', 'sch.pickB': 'A: {s} — अब गंतव्य (B) टैप करें', 'sch.tapHint': 'यात्रा के लिए दो स्टेशन टैप करें', 'sch.cancel': 'रद्द करें',
      'st.fromHere': 'यहाँ से', 'st.toHere': 'यहाँ तक', 'st.interchange': 'इंटरचेंज स्टेशन', 'st.lines': 'लाइनें',
      'near.title': 'आपके पास के स्टेशन', 'near.walk': 'पैदल', 'near.use': 'यहाँ से शुरू', 'near.err': 'आपका स्थान पता नहीं चल सका।',
      'info.hours': '🕒 संचालन समय', 'info.fares': '🎫 टिकट और किराया', 'info.about': 'ℹ️ इस प्रोजेक्ट के बारे में', 'info.tips': '💡 सुझाव', 'info.destinations': '📍 गंतव्य और निकटतम स्टेशन',
      'info.ticket': 'टिकट', 'info.standard': 'सामान्य', 'info.first': 'फ़र्स्ट क्लास',
      'place.near': 'निकटतम स्टेशन', 'min': 'मिनट', 'km': 'किमी', 'm': 'मी', 'legend.x': 'इंटरचेंज', 'map.fit': 'पूरा नेटवर्क', 'map.clear': 'रास्ता हटाएँ',
      'toast.copied': 'लिंक कॉपी हो गया ✓', 'line.stations': 'स्टेशन'
    },
    bn: {
      'app.title': 'রিয়াদ মেট্রো — যাত্রা গাইড',
      'tab.plan': '🧭 যাত্রা পরিকল্পনা', 'tab.lines': '🚇 লাইন', 'tab.guide': '📖 যাত্রী গাইড', 'tab.info': 'ℹ️ তথ্য', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'কোথা থেকে', 'plan.to': 'কোথায়', 'plan.search': 'স্টেশন বা জায়গা খুঁজুন…', 'plan.leaveAt': '🕒 ছাড়ার সময়', 'plan.now': 'এখন',
      'plan.fastest': '⚡ দ্রুততম', 'plan.fewest': '🔁 কম বদল', 'plan.go': 'রুট দেখান', 'plan.new': 'নতুন যাত্রা', 'plan.locate': 'আমার কাছের স্টেশন',
      'plan.hint': 'স্টেশন বা জায়গার নাম লিখুন, অথবা ডায়াগ্রামে দুটি স্টেশনে ট্যাপ করুন। সময় আনুমানিক।', 'plan.popular': 'জনপ্রিয় যাত্রা',
      'view.map': '🗺️ মানচিত্র', 'view.diagram': '🚇 ডায়াগ্রাম', 'view.gmaps': '🌐 গুগল ম্যাপস',
      'status.open': 'মেট্রো চালু · {t} পর্যন্ত', 'status.closed': 'মেট্রো বন্ধ · {t}-এ খুলবে', 'status.closedDay': 'মেট্রো বন্ধ · {d} {t}-এ খুলবে',
      'err.pick': 'শুরু ও গন্তব্য স্টেশন বেছে নিন।', 'err.same': 'শুরু ও গন্তব্য একই স্টেশন।', 'err.unknown': 'অজানা স্টেশন বা জায়গা: ',
      'res.title': 'প্রস্তাবিত যাত্রা', 'res.min': 'মিনিট', 'res.stops': 'স্টেশন', 'res.transfers': 'বদল', 'res.none': 'বদল ছাড়া', 'res.distance': 'দূরত্ব', 'res.fare': 'টিকিট',
      'res.firstClass': 'ফার্স্ট ক্লাস', 'res.standard': 'সাধারণ', 'res.sar': 'রিয়াল', 'res.depart': 'ছাড়বে', 'res.arrive': 'পৌঁছাবে', 'res.wait': 'ট্রেনের জন্য ~{n} মিনিট অপেক্ষা সহ',
      'res.est': 'সময় আনুমানিক। পরিষেবা: {h} — darb অ্যাপে যাচাই করুন।',
      'res.board': 'উঠুন', 'res.towards': 'অভিমুখে', 'res.alight': 'নামুন', 'res.change': 'বদলান', 'res.transferTime': 'আনুমানিক বদলের সময়',
      'res.showStops': 'পথের স্টেশন দেখান', 'res.start': 'শুরু', 'res.end': 'গন্তব্য', 'res.gmaps': 'Google Maps-এ খুলুন', 'res.share': 'যাত্রার লিংক কপি করুন',
      'res.walkFrom': '{p} থেকে {s} স্টেশন পর্যন্ত {d} হাঁটুন (~{n} মিনিট)', 'res.walkTo': 'তারপর {p} পর্যন্ত {d} হাঁটুন (~{n} মিনিট)',
      'warn.closed': 'নির্বাচিত সময়ে মেট্রো বন্ধ — সময় প্রথম ট্রেন ({t}) থেকে গণনা করা হয়েছে।', 'warn.late': 'আনুমানিক পৌঁছানো পরিষেবা শেষের ({t}) পরে — আগে রওনা দিন।',
      'warn.tight': 'পরিষেবা শেষের ({t}) একটু আগে পৌঁছাবেন — শেষ ট্রেন আগে ছাড়তে পারে।',
      'sch.pickA': 'ডায়াগ্রামে শুরুর স্টেশন (A) ট্যাপ করুন', 'sch.pickB': 'A: {s} — এবার গন্তব্য (B) ট্যাপ করুন', 'sch.tapHint': 'যাত্রার জন্য দুটি স্টেশনে ট্যাপ করুন', 'sch.cancel': 'বাতিল',
      'st.fromHere': 'এখান থেকে', 'st.toHere': 'এখানে', 'st.interchange': 'ইন্টারচেঞ্জ স্টেশন', 'st.lines': 'লাইন',
      'near.title': 'আপনার কাছের স্টেশন', 'near.walk': 'হেঁটে', 'near.use': 'এখান থেকে শুরু', 'near.err': 'আপনার অবস্থান পাওয়া যায়নি।',
      'info.hours': '🕒 চলাচলের সময়', 'info.fares': '🎫 টিকিট ও ভাড়া', 'info.about': 'ℹ️ এই প্রকল্প সম্পর্কে', 'info.tips': '💡 পরামর্শ', 'info.destinations': '📍 গন্তব্য ও নিকটতম স্টেশন',
      'info.ticket': 'টিকিট', 'info.standard': 'সাধারণ', 'info.first': 'ফার্স্ট ক্লাস',
      'place.near': 'নিকটতম স্টেশন', 'min': 'মিনিট', 'km': 'কিমি', 'm': 'মি', 'legend.x': 'ইন্টারচেঞ্জ', 'map.fit': 'পুরো নেটওয়ার্ক', 'map.clear': 'রুট মুছুন',
      'toast.copied': 'লিংক কপি হয়েছে ✓', 'line.stations': 'স্টেশন'
    },
    fil: {
      'app.title': 'Riyadh Metro — Gabay sa Biyahe',
      'tab.plan': '🧭 Magplano', 'tab.lines': '🚇 Mga linya', 'tab.guide': '📖 Gabay sa Biyahe', 'tab.info': 'ℹ️ Impormasyon', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'Mula sa', 'plan.to': 'Papunta sa', 'plan.search': 'Hanapin ang istasyon o lugar…', 'plan.leaveAt': '🕒 Alis', 'plan.now': 'Ngayon',
      'plan.fastest': '⚡ Pinakamabilis', 'plan.fewest': '🔁 Pinakakaunting lipat', 'plan.go': 'Ipakita ang ruta', 'plan.new': 'Bagong biyahe', 'plan.locate': 'Pinakamalapit na istasyon sa akin',
      'plan.hint': 'I-type ang pangalan ng istasyon o lugar, o i-tap ang dalawang istasyon sa diagram. Tantiya lang ang oras.', 'plan.popular': 'Sikat na biyahe',
      'view.map': '🗺️ Mapa', 'view.diagram': '🚇 Diagram', 'view.gmaps': '🌐 Google Maps',
      'status.open': 'Bukas ang metro · hanggang {t}', 'status.closed': 'Sarado ang metro · bubukas {t}', 'status.closedDay': 'Sarado ang metro · bubukas {d} {t}',
      'err.pick': 'Pumili ng pinanggalingan at destinasyon.', 'err.same': 'Pareho ang pinanggalingan at destinasyon.', 'err.unknown': 'Hindi kilalang istasyon o lugar: ',
      'res.title': 'Iminumungkahing biyahe', 'res.min': 'min', 'res.stops': 'istasyon', 'res.transfers': 'lipat', 'res.none': 'walang lipat', 'res.distance': 'Distansya', 'res.fare': 'Tiket',
      'res.firstClass': 'First class', 'res.standard': 'Regular', 'res.sar': 'SAR', 'res.depart': 'Alis', 'res.arrive': 'Dating', 'res.wait': 'kasama ang ~{n} min na paghihintay ng tren',
      'res.est': 'Tantiya lang ang oras. Serbisyo: {h} — tingnan sa darb app.',
      'res.board': 'Sumakay sa', 'res.towards': 'papuntang', 'res.alight': 'Bumaba sa', 'res.change': 'Lumipat sa', 'res.transferTime': 'tantiyang oras ng paglipat',
      'res.showStops': 'Ipakita ang mga istasyon sa daan', 'res.start': 'Simula', 'res.end': 'Dating', 'res.gmaps': 'Buksan sa Google Maps', 'res.share': 'Kopyahin ang link ng biyahe',
      'res.walkFrom': 'Maglakad ng {d} (~{n} min) mula {p} papuntang istasyon ng {s}', 'res.walkTo': 'Pagkatapos maglakad ng {d} (~{n} min) papuntang {p}',
      'warn.closed': 'Sarado ang metro sa napiling oras — kinalkula ang oras mula sa unang tren ({t}).', 'warn.late': 'Darating ka pagkatapos ng huling serbisyo ({t}) — umalis nang mas maaga.',
      'warn.tight': 'Darating ka malapit sa pagsasara ({t}) — maaaring maaga ang huling tren.',
      'sch.pickA': 'I-tap ang simulang istasyon (A) sa diagram', 'sch.pickB': 'A: {s} — i-tap ngayon ang destinasyon (B)', 'sch.tapHint': 'I-tap ang dalawang istasyon para magplano', 'sch.cancel': 'Kanselahin',
      'st.fromHere': 'Mula rito', 'st.toHere': 'Papunta rito', 'st.interchange': 'Interchange na istasyon', 'st.lines': 'Mga linya',
      'near.title': 'Pinakamalapit na istasyon sa iyo', 'near.walk': 'lakad', 'near.use': 'Magsimula rito', 'near.err': 'Hindi makuha ang lokasyon mo.',
      'info.hours': '🕒 Oras ng operasyon', 'info.fares': '🎫 Tiket at pamasahe', 'info.about': 'ℹ️ Tungkol sa proyekto', 'info.tips': '💡 Mga tip', 'info.destinations': '📍 Mga destinasyon at pinakamalapit na istasyon',
      'info.ticket': 'Tiket', 'info.standard': 'Regular', 'info.first': 'First class',
      'place.near': 'Pinakamalapit na istasyon', 'min': 'min', 'km': 'km', 'm': 'm', 'legend.x': 'Interchange', 'map.fit': 'Buong network', 'map.clear': 'Burahin ang ruta',
      'toast.copied': 'Nakopya ang link ✓', 'line.stations': 'istasyon'
    },
    fr: {
      'app.title': 'Métro de Riyad — Guide de trajet',
      'tab.plan': '🧭 Itinéraire', 'tab.lines': '🚇 Lignes', 'tab.guide': '📖 Guide du passager', 'tab.info': 'ℹ️ Infos', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'Départ', 'plan.to': 'Arrivée', 'plan.search': 'Station ou lieu…', 'plan.leaveAt': '🕒 Départ à', 'plan.now': 'Maintenant',
      'plan.fastest': '⚡ Le plus rapide', 'plan.fewest': '🔁 Moins de correspondances', 'plan.go': 'Afficher l’itinéraire', 'plan.new': 'Nouveau trajet', 'plan.locate': 'Station la plus proche de moi',
      'plan.hint': 'Saisissez une station ou un lieu (les anciens noms comme « Olaya » fonctionnent), ou touchez deux stations sur le plan. Durées estimées.', 'plan.popular': 'Trajets fréquents',
      'view.map': '🗺️ Carte', 'view.diagram': '🚇 Plan', 'view.gmaps': '🌐 Google Maps',
      'status.open': 'Métro en service · jusqu’à {t}', 'status.closed': 'Métro fermé · ouvre à {t}', 'status.closedDay': 'Métro fermé · ouvre {d} à {t}',
      'err.pick': 'Choisissez une station de départ et d’arrivée.', 'err.same': 'Départ et arrivée sont la même station.', 'err.unknown': 'Station ou lieu inconnu : ',
      'res.title': 'Trajet proposé', 'res.min': 'min', 'res.stops': 'stations', 'res.transfers': 'correspondances', 'res.none': 'sans correspondance', 'res.distance': 'Distance', 'res.fare': 'Billet',
      'res.firstClass': 'Première classe', 'res.standard': 'Standard', 'res.sar': 'SAR', 'res.depart': 'Départ', 'res.arrive': 'Arrivée', 'res.wait': 'dont ~{n} min d’attente du train',
      'res.est': 'Durées estimées. Service : {h} — vérifiez dans l’application darb.',
      'res.board': 'Prenez la', 'res.towards': 'direction', 'res.alight': 'Descendez à', 'res.change': 'Changez pour la', 'res.transferTime': 'temps de correspondance estimé',
      'res.showStops': 'Afficher les stations intermédiaires', 'res.start': 'Départ', 'res.end': 'Arrivée', 'res.gmaps': 'Ouvrir dans Google Maps', 'res.share': 'Copier le lien du trajet',
      'res.walkFrom': 'Marchez {d} (~{n} min) de {p} à la station {s}', 'res.walkTo': 'Puis marchez {d} (~{n} min) jusqu’à {p}',
      'warn.closed': 'Le métro est fermé à l’heure choisie — horaires calculés à partir du premier train ({t}).', 'warn.late': 'Arrivée prévue après la fin du service ({t}) — partez plus tôt.',
      'warn.tight': 'Vous arriverez peu avant la fermeture ({t}) — le dernier train peut partir plus tôt.',
      'sch.pickA': 'Touchez la station de départ (A) sur le plan', 'sch.pickB': 'A : {s} — touchez maintenant l’arrivée (B)', 'sch.tapHint': 'Touchez deux stations pour planifier un trajet', 'sch.cancel': 'Annuler',
      'st.fromHere': 'Partir d’ici', 'st.toHere': 'Aller ici', 'st.interchange': 'Station de correspondance', 'st.lines': 'Lignes',
      'near.title': 'Stations les plus proches', 'near.walk': 'à pied', 'near.use': 'Partir d’ici', 'near.err': 'Impossible d’obtenir votre position.',
      'info.hours': '🕒 Horaires', 'info.fares': '🎫 Billets et tarifs', 'info.about': 'ℹ️ À propos', 'info.tips': '💡 Conseils', 'info.destinations': '📍 Destinations et station la plus proche',
      'info.ticket': 'Billet', 'info.standard': 'Standard', 'info.first': 'Première classe',
      'place.near': 'Station la plus proche', 'min': 'min', 'km': 'km', 'm': 'm', 'legend.x': 'Correspondance', 'map.fit': 'Tout le réseau', 'map.clear': 'Effacer l’itinéraire',
      'toast.copied': 'Lien copié ✓', 'line.stations': 'stations'
    },
    ru: {
      'app.title': 'Метро Эр-Рияда — навигатор',
      'tab.plan': '🧭 Маршрут', 'tab.lines': '🚇 Линии', 'tab.guide': '📖 Гид пассажира', 'tab.info': 'ℹ️ Инфо', 'tab.export': '🌍 Earth / Maps',
      'plan.from': 'Откуда', 'plan.to': 'Куда', 'plan.search': 'Станция или место…', 'plan.leaveAt': '🕒 Отправление', 'plan.now': 'Сейчас',
      'plan.fastest': '⚡ Быстрее всего', 'plan.fewest': '🔁 Меньше пересадок', 'plan.go': 'Показать маршрут', 'plan.new': 'Новый маршрут', 'plan.locate': 'Ближайшая станция ко мне',
      'plan.hint': 'Введите станцию или место (старые названия вроде «Olaya» тоже работают) или нажмите две станции на схеме. Время приблизительное.', 'plan.popular': 'Популярные маршруты',
      'view.map': '🗺️ Карта', 'view.diagram': '🚇 Схема', 'view.gmaps': '🌐 Google Maps',
      'status.open': 'Метро работает · до {t}', 'status.closed': 'Метро закрыто · откроется в {t}', 'status.closedDay': 'Метро закрыто · откроется {d} в {t}',
      'err.pick': 'Выберите станции отправления и назначения.', 'err.same': 'Станции отправления и назначения совпадают.', 'err.unknown': 'Неизвестная станция или место: ',
      'res.title': 'Предлагаемый маршрут', 'res.min': 'мин', 'res.stops': 'станций', 'res.transfers': 'пересадок', 'res.none': 'без пересадок', 'res.distance': 'Расстояние', 'res.fare': 'Билет',
      'res.firstClass': 'Первый класс', 'res.standard': 'Стандарт', 'res.sar': 'SAR', 'res.depart': 'Отправление', 'res.arrive': 'Прибытие', 'res.wait': 'включая ~{n} мин ожидания поезда',
      'res.est': 'Время приблизительное. Режим работы: {h} — уточняйте в приложении darb.',
      'res.board': 'Садитесь на', 'res.towards': 'в сторону', 'res.alight': 'Выходите на', 'res.change': 'Пересядьте на', 'res.transferTime': 'расчётное время пересадки',
      'res.showStops': 'Показать промежуточные станции', 'res.start': 'Старт', 'res.end': 'Прибытие', 'res.gmaps': 'Открыть в Google Maps', 'res.share': 'Скопировать ссылку',
      'res.walkFrom': 'Пройдите {d} (~{n} мин) от {p} до станции {s}', 'res.walkTo': 'Затем пройдите {d} (~{n} мин) до {p}',
      'warn.closed': 'В выбранное время метро закрыто — время рассчитано от первого поезда ({t}).', 'warn.late': 'Ожидаемое прибытие после окончания работы ({t}) — выезжайте раньше.',
      'warn.tight': 'Вы прибудете незадолго до закрытия ({t}) — последний поезд может уйти раньше.',
      'sch.pickA': 'Нажмите станцию отправления (A) на схеме', 'sch.pickB': 'A: {s} — теперь нажмите станцию назначения (B)', 'sch.tapHint': 'Нажмите две станции, чтобы построить маршрут', 'sch.cancel': 'Отмена',
      'st.fromHere': 'Отсюда', 'st.toHere': 'Сюда', 'st.interchange': 'Пересадочная станция', 'st.lines': 'Линии',
      'near.title': 'Ближайшие станции', 'near.walk': 'пешком', 'near.use': 'Начать отсюда', 'near.err': 'Не удалось определить местоположение.',
      'info.hours': '🕒 Режим работы', 'info.fares': '🎫 Билеты и тарифы', 'info.about': 'ℹ️ О проекте', 'info.tips': '💡 Советы', 'info.destinations': '📍 Направления и ближайшая станция',
      'info.ticket': 'Билет', 'info.standard': 'Стандарт', 'info.first': 'Первый класс',
      'place.near': 'Ближайшая станция', 'min': 'мин', 'km': 'км', 'm': 'м', 'legend.x': 'Пересадка', 'map.fit': 'Вся сеть', 'map.clear': 'Убрать маршрут',
      'toast.copied': 'Ссылка скопирована ✓', 'line.stations': 'станций'
    }
  };
  var TIPS = {
    ar: [
      'تذكرة واحدة (ساعتان) تكفي لأي عدد من التبديلات بين مسارات المترو وحافلات الرياض خلال مدتها.',
      'المحطات ذات الإطار الأسود محطات تبادل؛ المسار الأصفر والبنفسجي يتشاركان المحطات الأربع من المركز المالي إلى سابك.',
      'إلى المطار: المسار الأصفر (4) من المركز المالي — نحو 33 دقيقة إلى الصالات 1-2 بدون تبديل.',
      'كل قطار يضم عربة للدرجة الأولى وعربات للعائلات وأخرى للأفراد — انتبه للعلامات على الرصيف.',
      'ادفع بالبطاقة البنكية اللاتلامسية أو ببطاقة/تطبيق درب عند البوابات؛ الأطفال دون 6 سنوات مجاناً.',
      'آخر قطار قد يغادر محطتك قبل موعد الإغلاق — في الرحلات المتأخرة تحقّق من تطبيق درب.'
    ],
    en: [
      'One 2-hour ticket covers any number of transfers between metro lines and Riyadh buses within its validity.',
      'Stations with a black ring are interchanges; the Yellow and Purple lines share the four stations from KAFD to SABIC.',
      'To the airport: Yellow line (4) from KAFD — about 33 minutes to Terminals 1-2 with no transfer.',
      'Every train has a first-class car, family cars and single-passenger cars — watch the platform markings.',
      'Pay with a contactless bank card or a darb card/app at the gates; children under 6 travel free.',
      'The last train may leave your station before closing time — for late trips check the darb app.'
    ]
  };

  /* ------------------------------------------------- passenger guide data */
  var GUIDE = {
    ar: {
      title: 'دليل ركاب مترو الرياض — قواعد وآداب ونصائح أول رحلة',
      sections: [
        { icon: '🎫', title: 'قبل أن تركب', html:
          '<ul><li>احصل على بطاقة <b>درب</b> أو استخدم تطبيق درب أو بطاقتك البنكية اللاتلامسية، واشحنها قبل الوصول إلى المحطة.</li>' +
          '<li>مرّر بطاقتك على <b>بوابة الدخول</b> عند الدخول وعلى <b>بوابة الخروج</b> عند الخروج — نسيان التمرير عند الخروج مخالفة وقد تُعتبر رحلتك غير مكتملة.</li>' +
          '<li>خطّط رحلتك مسبقاً من هذا التطبيق واعرف <b>رقم المسار واتجاهه</b> قبل الوصول إلى الرصيف.</li>' +
          '<li>آخر قطار قد يغادر محطتك قبل موعد الإغلاق المعلن — تحقق مبكراً للرحلات المتأخرة.</li></ul>' },
        { icon: '💳', title: 'بطاقة درب وطرق الدفع — كيف تحصل عليها وتشحنها', html:
          '<ul><li>يمكنك ركوب المترو بأربع طرق: <b>بطاقة درب</b>، <b>تطبيق درب</b>، <b>البطاقة البنكية اللاتلامسية</b> (مدى/فيزا/ماستركارد)، أو المحافظ الرقمية اللاتلامسية مثل Apple Pay.</li>' +
          '<li><b>الحصول على بطاقة درب</b>: من أجهزة البيع الذاتية ومراكز خدمة العملاء داخل محطات المترو، ثم سجّلها في تطبيق درب لربطها بحسابك.</li>' +
          '<li><b>شحن البطاقة</b>: فوراً عبر تطبيق درب بعد ربط البطاقة، أو من أجهزة البيع الذاتي في المحطات، أو عبر الموقع الإلكتروني — ويمكنك تفعيل الشحن التلقائي.</li>' +
          '<li>الأسعار الحالية:</li></ul>{{FARES}}' +
          '<ul><li class="ok-do">تذكرة واحدة تغطي المترو وحافلات الرياض معاً طوال مدتها، والأطفال دون 6 سنوات مجاناً مع شخص بالغ.</li>' +
          '<li class="ok-do">استخدم نفس طريقة الدفع عند الدخول وعند الخروج (نفس البطاقة أو نفس الجهاز) حتى تُحتسب الرحلة مكتملة.</li></ul>' +
          '<div class="note">💳 للاسترشاد فقط — تحقق من الأسعار وخيارات البطاقات في تطبيق درب الرسمي.</div>' },
        { icon: '🚉', title: 'محطات الصعود والنزول — هل هناك فرق؟', html:
          '<ul><li><b>لا يوجد فرق</b>: كل محطة في مترو الرياض تصعد منها وتنزل فيها؛ لا توجد «محطة صعود» وأخرى «نزول».</li>' +
          '<li>الذي يحدد رحلتك هو <b>اتجاه القطار</b>: لكل مسار نهايتان والقطار يتجه نحو إحداهما. قبل الصعود تحقق من شاشات ولافتات الرصيف: <b>«نحو …»</b> (اسم المحطة الأخيرة في ذلك الاتجاه).</li>' +
          '<li>إذا صعدت بالاتجاه الخطأ: انزل في المحطة التالية واعبر إلى الرصيف المقابل — القطارات تعمل في الاتجاهين على نفس المسار.</li>' +
          '<li>في رحلات التبديل، محطة التبديل هي محطة <b>نزول وصعود معاً</b>: انزل فيها واتبع لوحات «التبديل» إلى رصيف المسار التالي.</li>' +
          '<li>داخل القطار تابع أسماء المحطات في الشاشات والإعلانات الصوتية، أو فعّل <b>التتبع المباشر 📍</b> في هذا التطبيق ليصلك تنبيه قبل محطتك.</li></ul>' },
        { icon: '⚠️', title: 'المخالفات التي تجنّبك الغرامات', html:
          '<ul><li class="viol">الركوب دون تذكرة سارية، أو عدم تمرير البطاقة عند بوابات الدخول والخروج.</li>' +
          '<li class="viol">ركوب <b>عربات الدرجة الأولى</b> بتذكرة عادية — الدرجة الأولى تتطلب تذكرة أو بطاقة درجة أولى.</li>' +
          '<li class="viol"><b>التدخين</b> — بما فيه السجائر الإلكترونية — في المحطات والقطارات وكل مرافق المترو.</li>' +
          '<li class="viol">الأكل والشرب داخل عربات القطار.</li>' +
          '<li class="viol">رمي المخلفات في المحطات أو القطارات.</li>' +
          '<li class="viol">عرقلة إغلاق أبواب القطار أو التعلق بها.</li>' +
          '<li class="viol">العبث بمعدات الطوارئ والسلامة دون سبب.</li>' +
          '<li class="viol">تشغيل الأصوات مرتفعاً أو إزعاج الركاب.</li>' +
          '<li class="viol">وضع الأقدام على المقاعد أو الإضرار بمرافق المترو.</li></ul>' +
          '<div class="note">⚖️ قيم الغرامات تُحدَّد وفق لوائح الجهة المختصة وقد تتغيّر — تحقق من المصادر الرسمية (الهيئة الملكية لمدينة الرياض وتطبيق درب).</div>' },
        { icon: '🎒', title: 'الممنوعات والأمتعة', html:
          '<ul><li class="viol">المواد القابلة للاشتعال أو الانفجار والمواد الكيميائية الخطرة.</li>' +
          '<li class="viol">الأدوات الحادة غير المغلّفة وكل ما قد يؤذي الركاب.</li>' +
          '<li>الأمتعة الضخمة التي تعيق الممرات والأبواب — الحقائب الشخصية وحقائب السفر المعقولة مسموحة.</li>' +
          '<li>الحيوانات — باستثناء <b>كلاب الإرشاد</b> المرافقة لذوي الإعاقة البصرية.</li>' +
          '<li>الدراجات غير المطوية في أوقات الذروة؛ السكوترات المطوية أسهل في النقل.</li>' +
          '<li>عربات الأطفال والكراسي المتحركة مسموحة — استخدم المصاعد وثبّتها جيداً داخل القطار.</li></ul>' },
        { icon: '✅', title: 'سلوكيات صحيحة تسهّل عليك وعلى الآخرين', html:
          '<ul><li class="ok-do">أفسح المجال للنازلين قبل الصعود، وانتظر جانبي الباب لا أمامه.</li>' +
          '<li class="ok-do">قف خلف <b>الخط الأصفر</b> على حافة الرصيف حتى يتوقف القطار تماماً.</li>' +
          '<li class="ok-do">قدّم مقاعد الأولوية لكبار السن وذوي الإعاقة والحوامل ومن يحتاجها.</li>' +
          '<li class="ok-do">تمسّك بالمقابض أثناء الحركة، وابتعد عن الأبواب أثناء فتحها وإغلاقها.</li>' +
          '<li class="ok-do">بعض العربات للعائلات وأخرى للدرجة الأولى — لاحظ اللافتات وعلامات الرصيف قبل الصعود.</li>' +
          '<li class="ok-do">استخدم سماعات الأذن، وجهّز بطاقتك قبل الوصول إلى البوابة لتجنب الازدحام.</li></ul>' },
        { icon: '🥇', title: 'الدرجة الأولى', html:
          '<ul><li>تتطلب <b>تذكرة درجة أولى</b> (10 ريالات لساعتين مقابل 4 ريالات للدرجة العادية).</li>' +
          '<li>عربات الدرجة الأولى محددة بلافتات على الرصيف وفي القطار؛ صعودها بتذكرة عادية <span class="viol">مخالفة تستوجب الغرامة</span>.</li></ul>' },
        { icon: '👣', title: 'خطوات أول رحلة — من الباب إلى الباب', html:
          '<ol class="board-steps"><li>توجه إلى أقرب محطة إليك (زر 📍 في هذا التطبيق) وادخل إلى صالة المحطة.</li>' +
          '<li>مرّر بطاقة درب أو التطبيق أو بطاقتك البنكية على <b>بوابة الدخول</b>.</li>' +
          '<li>من الشاشات تحقق من رقم مسارك ووجهة القطار (<b>«نحو …»</b>)، ثم اصعد إلى الرصيف الصحيح.</li>' +
          '<li>قف خلف الخط الأصفر، وأفسح للنازلين، ثم اصعد إلى القطار.</li>' +
          '<li>راقب أسماء المحطات في شاشات القطار — أو فعّل <b>التتبع المباشر 📍</b> ليصلك تنبيه «استعد للنزول» قبل محطتك.</li>' +
          '<li>إن كانت رحلتك فيها تبديل: انزل في محطة التبديل واتبع لوحات المسار التالي.</li>' +
          '<li>عند الوصول إلى محطتك انزل واتبع لوحات <b>«الخروج»</b>.</li>' +
          '<li>مرّر بطاقتك على <b>بوابة الخروج</b> لتكتمل الرحلة بشكل صحيح.</li></ol>' },
        { icon: '🚨', title: 'أخطاء شائعة في أول رحلة — وكيف تتجنبها', html:
          '<ul><li class="viol">نسيان تمرير البطاقة عند الخروج ← اجعلها آخر خطوة في كل رحلة.</li>' +
          '<li class="viol">الصعود بالاتجاه الخطأ ← تحقق من «نحو …» في شاشة الرصيف قبل الصعود.</li>' +
          '<li class="viol">الالتباس بين محطة الصعود ومحطة النزول ← لا يوجد فرق؛ الاتجاه هو المهم.</li>' +
          '<li class="viol">ركوب الدرجة الأولى بتذكرة عادية ← تحقق من لافتة العربة قبل الدخول.</li>' +
          '<li class="viol">تفويت محطة النزول ← فعّل التتبع المباشر 📍 ليصلك تنبيه قبل الوصول.</li></ul>' }
      ]
    },
    en: {
      title: 'Riyadh Metro rider guide — rules, etiquette and first-ride tips',
      sections: [
        { icon: '🎫', title: 'Before you ride', html:
          '<ul><li>Get a <b>darb</b> card, the darb app, or use a contactless bank card — and top it up before you arrive.</li>' +
          '<li>Tap your card at the <b>entry gate</b> and again at the <b>exit gate</b> — forgetting to tap out is a violation and your trip may count as incomplete.</li>' +
          '<li>Plan your trip in this app first and know your <b>line number and direction</b> before reaching the platform.</li>' +
          '<li>The last train may leave your station before the advertised closing time — check early for late trips.</li></ul>' },
        { icon: '💳', title: 'The darb card & payment — getting it and topping up', html:
          '<ul><li>You can ride in four ways: the <b>darb card</b>, the <b>darb app</b>, a <b>contactless bank card</b> (mada/Visa/Mastercard), or a contactless wallet such as Apple Pay.</li>' +
          '<li><b>Getting a darb card</b>: from ticket vending machines and customer-service desks inside metro stations, then register it in the darb app to link it to your account.</li>' +
          '<li><b>Topping up</b>: instantly through the darb app after linking your card, at station vending machines, or online — auto-reload can be enabled.</li>' +
          '<li>Current fares:</li></ul>{{FARES}}' +
          '<ul><li class="ok-do">One ticket covers both the metro and Riyadh buses for its whole validity, and children under 6 ride free with an adult.</li>' +
          '<li class="ok-do">Use the same payment method to tap in and tap out (same card or device) so the trip counts as complete.</li></ul>' +
          '<div class="note">💳 Indicative only — verify fares and card options in the official darb app.</div>' },
        { icon: '🚉', title: 'Boarding and alighting stations — is there a difference?', html:
          '<ul><li><b>There is no difference</b>: every Riyadh Metro station lets you board and alight; there are no dedicated boarding or alighting stations.</li>' +
          '<li>What decides your trip is the <b>train\u2019s direction</b>: each line has two termini. Before boarding, check the platform screens and signs for <b>\u201Ctowards \u2026\u201D</b> (the last station in that direction).</li>' +
          '<li>If you board the wrong direction: alight at the next station and cross to the opposite platform — trains run both ways on every line.</li>' +
          '<li>On transfer trips the transfer station is for <b>alighting and boarding</b>: get off there and follow the transfer signs to the next line\u2019s platform.</li>' +
          '<li>On board, follow station names on the screens and announcements, or turn on <b>Live tracking \ud83d\udccd</b> in this app to get an alert before your stop.</li></ul>' },
        { icon: '⚠️', title: 'Violations that get you fined', html:
          '<ul><li class="viol">Riding without a valid ticket, or not tapping your card at the entry/exit gates.</li>' +
          '<li class="viol">Riding <b>first-class cars</b> with a standard ticket — first class requires a first-class ticket or card.</li>' +
          '<li class="viol"><b>Smoking</b> — including e-cigarettes — anywhere in stations, trains or metro facilities.</li>' +
          '<li class="viol">Eating and drinking inside train cars.</li>' +
          '<li class="viol">Littering in stations or trains.</li>' +
          '<li class="viol">Blocking or holding the train doors.</li>' +
          '<li class="viol">Tampering with emergency or safety equipment without cause.</li>' +
          '<li class="viol">Playing audio loudly or disturbing other passengers.</li>' +
          '<li class="viol">Putting feet on seats or damaging metro property.</li></ul>' +
          '<div class="note">⚖️ Fine amounts are set by the competent authority and may change — verify with official sources (RCRC and the darb app).</div>' },
        { icon: '🎒', title: 'Prohibited items and luggage', html:
          '<ul><li class="viol">Flammable, explosive or hazardous chemicals.</li>' +
          '<li class="viol">Unwrapped sharp tools and anything that may harm passengers.</li>' +
          '<li>Oversized luggage that blocks aisles or doors — personal bags and reasonable suitcases are allowed.</li>' +
          '<li>Animals — except <b>guide dogs</b> assisting visually impaired passengers.</li>' +
          '<li>Non-folding bicycles during peak hours; folding scooters are easier.</li>' +
          '<li>Strollers and wheelchairs are welcome — use the lifts and secure them inside the train.</li></ul>' },
        { icon: '✅', title: 'Good habits that make rides easier', html:
          '<ul><li class="ok-do">Let passengers alight before boarding; wait at the sides of the doors, not in front of them.</li>' +
          '<li class="ok-do">Stand behind the <b>yellow line</b> until the train fully stops.</li>' +
          '<li class="ok-do">Offer priority seats to the elderly, people with disabilities, pregnant women and anyone who needs them.</li>' +
          '<li class="ok-do">Hold the handrails while moving and keep clear of the doors.</li>' +
          '<li class="ok-do">Some cars are family cars and some are first class — check the platform markings and signs before boarding.</li>' +
          '<li class="ok-do">Use headphones, and have your card ready before you reach the gate.</li></ul>' },
        { icon: '🥇', title: 'First class', html:
          '<ul><li>Requires a <b>first-class ticket</b> (SAR 10 for 2 hours vs SAR 4 standard).</li>' +
          '<li>First-class cars are marked on the platform and on the train; boarding them with a standard ticket is a <span class="viol">fined violation</span>.</li></ul>' },
        { icon: '👣', title: 'Your first ride, step by step', html:
          '<ol class="board-steps"><li>Head to your nearest station (the \ud83d\udccd button in this app) and enter the station hall.</li>' +
          '<li>Tap your darb card, the app or your bank card at the <b>entry gate</b>.</li>' +
          '<li>Check the screens for your line number and the train\u2019s direction (<b>\u201Ctowards \u2026\u201D</b>), then go to the correct platform.</li>' +
          '<li>Stand behind the yellow line, let people alight, then board.</li>' +
          '<li>Watch the station names on the train screens — or turn on <b>Live tracking \ud83d\udccd</b> to get a \u201Cget ready to alight\u201D alert before your stop.</li>' +
          '<li>If your trip has a transfer: alight at the transfer station and follow the signs to the next line.</li>' +
          '<li>At your destination, get off and follow the <b>Exit</b> signs.</li>' +
          '<li>Tap your card at the <b>exit gate</b> to complete the trip correctly.</li></ol>' },
        { icon: '🚨', title: 'Common first-ride mistakes — and how to avoid them', html:
          '<ul><li class="viol">Forgetting to tap out at the exit gate \u2190 make it the last step of every trip.</li>' +
          '<li class="viol">Boarding the wrong direction \u2190 check \u201Ctowards \u2026\u201D on the platform screen first.</li>' +
          '<li class="viol">Confusing boarding vs alighting stations \u2190 there is no difference; the direction is what matters.</li>' +
          '<li class="viol">Riding first class on a standard ticket \u2190 check the car markings before stepping in.</li>' +
          '<li class="viol">Missing your station \u2190 turn on Live tracking \ud83d\udccd to be alerted before arrival.</li></ul>' }
      ]
    }
  };
  var FV_TIPS = {
    ar: [
      { ic: '🎫', txt: 'مرّر بطاقتك على بوابة الدخول <b>وبوابة الخروج</b> — نسيان التمرير عند الخروج مخالفة.' },
      { ic: '🧭', txt: 'لا توجد «محطة صعود» و«محطة نزول» — كل محطة للاثنين، والمهم <b>اتجاه القطار</b> («نحو …») المكتوب في شاشات الرصيف.' },
      { ic: '🥇', txt: 'الدرجة الأولى تتطلب تذكرة درجة أولى — الصعود إليها بالتذكرة العادية غرامة.' },
      { ic: '🚭', txt: 'التدخين (حتى الإلكتروني) والأكل والشرب داخل القطار ممنوعة ومعاقب عليها.' },
      { ic: '📍', txt: 'فعّل زر <b>التتبع المباشر 📍</b> من الخريطة: يحدد أقرب محطة إليك وينبهك قبل محطة النزول.' }
    ],
    en: [
      { ic: '🎫', txt: 'Tap your card at the entry gate <b>and the exit gate</b> — forgetting to tap out is a violation.' },
      { ic: '🧭', txt: 'There are no \u201Cboarding\u201D and \u201Calighting\u201D stations — every station is both. What matters is the <b>train\u2019s direction</b> (\u201Ctowards \u2026\u201D on platform screens).' },
      { ic: '🥇', txt: 'First class needs a first-class ticket — boarding it with a standard ticket is fined.' },
      { ic: '🚭', txt: 'Smoking (including vapes) and eating or drinking on trains are prohibited and fined.' },
      { ic: '📍', txt: 'Turn on <b>Live tracking \ud83d\udccd</b> on the map: it finds your nearest station and alerts you before your stop.' }
    ]
  };

  /* ═══════════════════════════════════════════════════════════════════════
     2026 interface redesign — new & revised copy
     ─────────────────────────────────────────────────────────────────────
     Kept as a merge block (instead of editing the dictionaries above) so the
     redesign's wording can be reviewed and re-translated in one place. These
     values win over the originals because the merge runs last.
     ═══════════════════════════════════════════════════════════════════════ */
  var EXTRA = {
    ar: {
      'app.short': 'مترو الرياض',
      'brand.home': '— الصفحة الرئيسية',
      'status.more': '— ساعات التشغيل والتذاكر',
      'nav.lines': 'المسارات', 'nav.guide': 'دليل الركاب', 'nav.data': 'بيانات مفتوحة', 'nav.cta': 'خطّط رحلتك',
      'hero.eyebrow': 'شبكة مترو الرياض · مشروع مجتمعي مفتوح',
      'hero.title1': 'كلّ الرياض', 'hero.title2': 'على بُعد محطة.',
      'hero.description': 'اكتب محطةً أو مكاناً — أو اضغط محطتين على الشبكة: نرتّب لك المسار والتبديلات والوقت والأجرة، ثم نرسم رحلتك على الخط نفسه.',
      'hero.builderKicker': 'ابدأ من هنا', 'hero.builderTitle': 'من أين إلى أين؟',
      'hero.stageKicker': 'الشبكة الحيّة', 'hero.stageTitle': 'شبكة مترو الرياض', 'hero.stageOpen': 'المخطط الكامل',
      'hero.railAria': 'مسارات مترو الرياض', 'hero.scroll': 'استكشف الشبكة',
      'hero.railStations': 'محطة', 'hero.interchanges': 'محطة تبادل',
      'hero.tapHint': 'اضغط أي محطة على الشبكة لتبدأ رحلتك',
      'hero.captionPicked': 'اختر محطة أخرى لإكمال الرحلة', 'hero.captionPlanned': 'رحلتك مرسومة على الشبكة',
      'metric.places': 'وجهة', 'metric.placesSub': 'مولات ومعالم ومستشفيات',
      'linesShowcase.eyebrow': 'ستة مسارات، مدينة واحدة',
      'linesShowcase.title1': 'كل مسار', 'linesShowcase.title2': 'يحكي محوراً من المدينة.',
      'linesShowcase.description': 'من المطار شمالاً إلى الحائر جنوباً، ومن جامعة الملك سعود غرباً إلى خشم العان شرقاً — اختر مساراً لترى محطاته على الشبكة.',
      'linesShowcase.explore': 'اعرضه على المخطط',
      'guideShowcase.eyebrow': 'قبل أن تركب',
      'guideShowcase.title1': 'أول رحلة؟', 'guideShowcase.title2': 'دقيقة توفّر عليك غرامة.',
      'guideShowcase.description': 'هذه أكثر خمسة أخطاء يقع فيها الركاب الجدد. الدليل الكامل يشرح المخالفات والغرامات، بطاقة درب وطرق الدفع، وخطوات الرحلة من الباب إلى الباب.',
      'guideShowcase.open': '📖 افتح دليل الركاب الكامل', 'guideShowcase.quick': '⚡ الأخطاء الخمسة',
      'dataShowcase.eyebrow': 'مفتوح للمطوّرين',
      'dataShowcase.title1': 'بيانات الشبكة', 'dataShowcase.title2': 'بصيغ تستخدمها فعلاً.',
      'dataShowcase.description': 'نفس مصدر الحقيقة الذي يبني هذا الموقع: KML/KMZ لـ Google Earth وMy Maps، وGeoJSON وCSV وGPX للخرائط والتحليل، وملف الشبكة القابل للتوجيه.',
      'dataShowcase.moreFile': 'كل الملفات', 'dataShowcase.moreBody': 'بقية الملفات والوثائق والمصادر على GitHub.',
      'footer.nav': 'روابط التذييل', 'top.back': 'إلى الأعلى'
    },
    en: {
      'app.short': 'Riyadh Metro',
      'brand.home': '— home',
      'status.more': '— hours and fares',
      'nav.lines': 'Lines', 'nav.guide': 'Rider guide', 'nav.data': 'Open data', 'nav.cta': 'Plan a trip',
      'hero.eyebrow': 'Riyadh Metro network · open community project',
      'hero.title1': 'All of Riyadh,', 'hero.title2': 'one stop away.',
      'hero.description': 'Type a station or a place — or tap two stations on the network. We work out the route, the transfers, the time and the fare, then draw your trip on the line itself.',
      'hero.builderKicker': 'Start here', 'hero.builderTitle': 'Where from, where to?',
      'hero.stageKicker': 'Live network', 'hero.stageTitle': 'Riyadh Metro network', 'hero.stageOpen': 'Full diagram',
      'hero.railAria': 'Riyadh Metro lines', 'hero.scroll': 'Explore the network',
      'hero.railStations': 'stations', 'hero.interchanges': 'interchanges',
      'hero.tapHint': 'Tap any station on the network to start your trip',
      'hero.captionPicked': 'pick another station to complete the trip', 'hero.captionPlanned': 'your trip is drawn on the network',
      'metric.places': 'destinations', 'metric.placesSub': 'malls, landmarks, hospitals',
      'linesShowcase.eyebrow': 'Six lines, one city',
      'linesShowcase.title1': 'Every line', 'linesShowcase.title2': 'tells one axis of the city.',
      'linesShowcase.description': 'From the airport in the north to Al-Hair in the south, and from King Saud University in the west to Khashm Al-An in the east — pick a line and see its stations on the network.',
      'linesShowcase.explore': 'Show it on the diagram',
      'guideShowcase.eyebrow': 'Before you ride',
      'guideShowcase.title1': 'First ride?', 'guideShowcase.title2': 'One minute saves you a fine.',
      'guideShowcase.description': 'The five mistakes new riders make most. The full guide covers fines and violations, the darb card and payment methods, and the trip step by step from door to door.',
      'guideShowcase.open': '📖 Open the full rider guide', 'guideShowcase.quick': '⚡ The five mistakes',
      'dataShowcase.eyebrow': 'Open for developers',
      'dataShowcase.title1': 'Network data', 'dataShowcase.title2': 'in formats you actually use.',
      'dataShowcase.description': 'The single source of truth that builds this site: KML/KMZ for Google Earth and My Maps, GeoJSON, CSV and GPX for maps and analysis, and the routable network file.',
      'dataShowcase.moreFile': 'All files', 'dataShowcase.moreBody': 'The remaining exports, documentation and sources live on GitHub.',
      'footer.nav': 'Footer links', 'top.back': 'Back to top'
    },
    ur: {
      'app.short': 'ریاض میٹرو',
      'brand.home': '— صفحۂ اول',
      'status.more': '— اوقات اور کرایہ',
      'nav.lines': 'لائنیں', 'nav.guide': 'مسافر گائیڈ', 'nav.data': 'اوپن ڈیٹا', 'nav.cta': 'سفر کی منصوبہ بندی',
      'hero.eyebrow': 'ریاض میٹرو نیٹ ورک · اوپن کمیونٹی پروجیکٹ',
      'hero.title1': 'پورا ریاض', 'hero.title2': 'صرف ایک اسٹیشن دور۔',
      'hero.description': 'اسٹیشن یا جگہ لکھیں، یا نیٹ ورک پر دو اسٹیشن دبائیں: ہم راستہ، تبدیلیاں، وقت اور کرایہ بتاتے ہیں اور آپ کا سفر اسی لائن پر کھینچ دیتے ہیں۔',
      'hero.builderKicker': 'یہاں سے شروع کریں', 'hero.builderTitle': 'کہاں سے کہاں؟',
      'hero.stageKicker': 'براہ راست نیٹ ورک', 'hero.stageTitle': 'ریاض میٹرو نیٹ ورک', 'hero.stageOpen': 'مکمل نقشہ',
      'hero.railAria': 'ریاض میٹرو لائنیں', 'hero.scroll': 'نیٹ ورک دیکھیں',
      'hero.railStations': 'اسٹیشن', 'hero.interchanges': 'انٹرجینج',
      'hero.tapHint': 'سفر شروع کرنے کے لیے نیٹ ورک پر کوئی اسٹیشن دبائیں',
      'hero.captionPicked': 'سفر مکمل کرنے کے لیے دوسرا اسٹیشن چنیں', 'hero.captionPlanned': 'آپ کا سفر نیٹ ورک پر کھنچ گیا',
      'metric.places': 'مقامات', 'metric.placesSub': 'مال، عجائب گھر، اسپتال',
      'linesShowcase.eyebrow': 'چھ لائنیں، ایک شہر',
      'linesShowcase.title1': 'ہر لائن', 'linesShowcase.title2': 'شہر کا ایک محور بتاتی ہے۔',
      'linesShowcase.description': 'ہوائی اڈے سے شمال میں الحائر تک جنوب میں، اور کنگ سعود یونیورسٹی سے مغرب میں خشم العان تک مشرق میں — کوئی لائن چنیں اور اس کے اسٹیشن نیٹ ورک پر دیکھیں۔',
      'linesShowcase.explore': 'نقشے پر دکھائیں',
      'guideShowcase.eyebrow': 'سوار ہونے سے پہلے',
      'guideShowcase.title1': 'پہلا سفر؟', 'guideShowcase.title2': 'ایک منٹ آپ کو جرمانے سے بچاتا ہے۔',
      'guideShowcase.description': 'نئے مسافروں کی پانچ عام غلطیاں۔ مکمل گائیڈ میں جرمانے، درب کارڈ اور ادائیگی کے طریقے، اور دروازے سے دروازے تک سفر کے مراحل ہیں۔',
      'guideShowcase.open': '📖 مکمل مسافر گائیڈ کھولیں', 'guideShowcase.quick': '⚡ پانچ غلطیاں',
      'dataShowcase.eyebrow': 'ڈویلپرز کے لیے کھلا',
      'dataShowcase.title1': 'نیٹ ورک ڈیٹا', 'dataShowcase.title2': 'ایسی فارمیٹس میں جو آپ استعمال کرتے ہیں۔',
      'dataShowcase.description': 'وہی ایک ذریعہ جو یہ سائٹ بناتا ہے: Google Earth اور My Maps کے لیے KML/KMZ، نقشوں اور تجزیے کے لیے GeoJSON، CSV اور GPX، اور روٹنگ کے قابل نیٹ ورک فائل۔',
      'dataShowcase.moreFile': 'تمام فائلیں', 'dataShowcase.moreBody': 'باقی برآمدات، دستاویزات اور ذرائع GitHub پر۔',
      'footer.nav': 'فٹر لنکس', 'top.back': 'اوپر واپس'
    },
    hi: {
      'app.short': 'रियाद मेट्रो',
      'brand.home': '— मुख्य पृष्ठ',
      'status.more': '— समय और किराया',
      'nav.lines': 'लाइनें', 'nav.guide': 'यात्री गाइड', 'nav.data': 'ओपन डेटा', 'nav.cta': 'यात्रा बनाएँ',
      'hero.eyebrow': 'रियाद मेट्रो नेटवर्क · खुली सामुदायिक परियोजना',
      'hero.title1': 'पूरा रियाद', 'hero.title2': 'बस एक स्टेशन दूर।',
      'hero.description': 'कोई स्टेशन या जगह लिखें, या नेटवर्क पर दो स्टेशन चुनें: हम रास्ता, बदलाव, समय और किराया बताते हैं और आपकी यात्रा उसी लाइन पर बना देते हैं।',
      'hero.builderKicker': 'यहाँ से शुरू करें', 'hero.builderTitle': 'कहाँ से कहाँ?',
      'hero.stageKicker': 'लाइव नेटवर्क', 'hero.stageTitle': 'रियाद मेट्रो नेटवर्क', 'hero.stageOpen': 'पूरा नक्शा',
      'hero.railAria': 'रियाद मेट्रो लाइनें', 'hero.scroll': 'नेटवर्क देखें',
      'hero.railStations': 'स्टेशन', 'hero.interchanges': 'इंटरचेंज',
      'hero.tapHint': 'यात्रा शुरू करने के लिए नेटवर्क पर कोई स्टेशन दबाएँ',
      'hero.captionPicked': 'यात्रा पूरी करने के लिए दूसरा स्टेशन चुनें', 'hero.captionPlanned': 'आपकी यात्रा नेटवर्क पर बन गई',
      'metric.places': 'गंतव्य', 'metric.placesSub': 'मॉल, स्थल, अस्पताल',
      'linesShowcase.eyebrow': 'छह लाइनें, एक शहर',
      'linesShowcase.title1': 'हर लाइन', 'linesShowcase.title2': 'शहर की एक धुरी बताती है।',
      'linesShowcase.description': 'उत्तर में हवाई अड्डे से दक्षिण में अल-हायर तक, और पश्चिम में किंग सऊद यूनिवर्सिटी से पूर्व में खश्म अल-आन तक — कोई लाइन चुनें और उसके स्टेशन नेटवर्क पर देखें।',
      'linesShowcase.explore': 'नक्शे पर देखें',
      'guideShowcase.eyebrow': 'चढ़ने से पहले',
      'guideShowcase.title1': 'पहली यात्रा?', 'guideShowcase.title2': 'एक मिनट आपको जुर्माने से बचाता है।',
      'guideShowcase.description': 'नए यात्रियों की पाँच आम गलतियाँ। पूरी गाइड में जुर्माने, दर्ब कार्ड और भुगतान के तरीके, और दरवाज़े से दरवाज़े तक के चरण हैं।',
      'guideShowcase.open': '📖 पूरी यात्री गाइड खोलें', 'guideShowcase.quick': '⚡ पाँच गलतियाँ',
      'dataShowcase.eyebrow': 'डेवलपर्स के लिए खुला',
      'dataShowcase.title1': 'नेटवर्क डेटा', 'dataShowcase.title2': 'उन फ़ॉर्मैट में जो आप सच में इस्तेमाल करते हैं।',
      'dataShowcase.description': 'वही एक स्रोत जो यह साइट बनाता है: Google Earth और My Maps के लिए KML/KMZ, नक्शे और विश्लेषण के लिए GeoJSON, CSV और GPX, और रूटेबल नेटवर्क फ़ाइल।',
      'dataShowcase.moreFile': 'सभी फ़ाइलें', 'dataShowcase.moreBody': 'बाक़ी एक्सपोर्ट, दस्तावेज़ और स्रोत GitHub पर।',
      'footer.nav': 'फ़ुटर लिंक', 'top.back': 'ऊपर वापस'
    },
    bn: {
      'app.short': 'রিয়াদ মেট্রো',
      'brand.home': '— প্রধান পৃষ্ঠা',
      'status.more': '— সময়সূচি ও ভাড়া',
      'nav.lines': 'লাইন', 'nav.guide': 'যাত্রী গাইড', 'nav.data': 'ওপেন ডেটা', 'nav.cta': 'যাত্রা পরিকল্পনা',
      'hero.eyebrow': 'রিয়াদ মেট্রো নেটওয়ার্ক · উন্মুক্ত কমিউনিটি প্রকল্প',
      'hero.title1': 'পুরো রিয়াদ', 'hero.title2': 'মাত্র এক স্টেশন দূরে।',
      'hero.description': 'একটি স্টেশন বা জায়গা লিখুন, অথবা নেটওয়ার্কে দুটি স্টেশন চাপুন: আমরা পথ, বদল, সময় ও ভাড়া ঠিক করে দিই এবং আপনার যাত্রা সেই লাইনেই এঁকে দিই।',
      'hero.builderKicker': 'এখান থেকে শুরু করুন', 'hero.builderTitle': 'কোথা থেকে কোথায়?',
      'hero.stageKicker': 'লাইভ নেটওয়ার্ক', 'hero.stageTitle': 'রিয়াদ মেট্রো নেটওয়ার্ক', 'hero.stageOpen': 'সম্পূর্ণ নকশা',
      'hero.railAria': 'রিয়াদ মেট্রো লাইন', 'hero.scroll': 'নেটওয়ার্ক দেখুন',
      'hero.railStations': 'স্টেশন', 'hero.interchanges': 'ইন্টারচেঞ্জ',
      'hero.tapHint': 'যাত্রা শুরু করতে নেটওয়ার্কের যেকোনো স্টেশনে চাপুন',
      'hero.captionPicked': 'যাত্রা সম্পূর্ণ করতে আরেকটি স্টেশন বাছুন', 'hero.captionPlanned': 'আপনার যাত্রা নেটওয়ার্কে আঁকা হয়েছে',
      'metric.places': 'গন্তব্য', 'metric.placesSub': 'মল, স্থাপনা, হাসপাতাল',
      'linesShowcase.eyebrow': 'ছয়টি লাইন, এক শহর',
      'linesShowcase.title1': 'প্রতিটি লাইন', 'linesShowcase.title2': 'শহরের একটি অক্ষ বলে।',
      'linesShowcase.description': 'উত্তরে বিমানবন্দর থেকে দক্ষিণে আল-হায়ের, আর পশ্চিমে কিং সউদ বিশ্ববিদ্যালয় থেকে পূর্বে খাশম আল-আন — একটি লাইন বেছে নিন ও তার স্টেশনগুলো নেটওয়ার্কে দেখুন।',
      'linesShowcase.explore': 'নকশায় দেখুন',
      'guideShowcase.eyebrow': 'ওঠার আগে',
      'guideShowcase.title1': 'প্রথম যাত্রা?', 'guideShowcase.title2': 'এক মিনিট আপনাকে জরিমানা থেকে বাঁচায়।',
      'guideShowcase.description': 'নতুন যাত্রীদের পাঁচটি সাধারণ ভুল। পূর্ণ গাইডে জরিমানা, দারব কার্ড ও পেমেন্টের নিয়ম, এবং দরজা থেকে দরজা পর্যন্ত ধাপ আছে।',
      'guideShowcase.open': '📖 সম্পূর্ণ যাত্রী গাইড খুলুন', 'guideShowcase.quick': '⚡ পাঁচটি ভুল',
      'dataShowcase.eyebrow': 'ডেভেলপারদের জন্য উন্মুক্ত',
      'dataShowcase.title1': 'নেটওয়ার্ক ডেটা', 'dataShowcase.title2': 'যে ফরম্যাটে আপনি সত্যিই ব্যবহার করেন।',
      'dataShowcase.description': 'একই একক উৎস যা এই সাইট তৈরি করে: Google Earth ও My Maps-এর জন্য KML/KMZ, মানচিত্র ও বিশ্লেষণের জন্য GeoJSON, CSV ও GPX, এবং রাউটেবল নেটওয়ার্ক ফাইল।',
      'dataShowcase.moreFile': 'সব ফাইল', 'dataShowcase.moreBody': 'বাকি এক্সপোর্ট, ডকুমেন্টেশন ও সূত্র GitHub-এ।',
      'footer.nav': 'ফুটার লিংক', 'top.back': 'উপরে ফিরুন'
    },
    fil: {
      'app.short': 'Riyadh Metro',
      'brand.home': '— pangunahing pahina',
      'status.more': '— oras at pamasahe',
      'nav.lines': 'Mga linya', 'nav.guide': 'Gabay sa mananakay', 'nav.data': 'Open data', 'nav.cta': 'Magplano ng biyahe',
      'hero.eyebrow': 'Riyadh Metro network · open na proyekto ng komunidad',
      'hero.title1': 'Ang buong Riyadh,', 'hero.title2': 'isang istasyon lang ang layo.',
      'hero.description': 'Mag-type ng istasyon o lugar, o pindutin ang dalawang istasyon sa network: aming aayusin ang ruta, mga paglipat, oras at bayad — saka iguguhit ang biyahe mo sa linya mismo.',
      'hero.builderKicker': 'Magsimula rito', 'hero.builderTitle': 'Saan papunta?',
      'hero.stageKicker': 'Live na network', 'hero.stageTitle': 'Riyadh Metro network', 'hero.stageOpen': 'Buong diagram',
      'hero.railAria': 'Mga linya ng Riyadh Metro', 'hero.scroll': 'Galugarin ang network',
      'hero.railStations': 'istasyon', 'hero.interchanges': 'interchange',
      'hero.tapHint': 'Pindutin ang kahit anong istasyon sa network para magsimula',
      'hero.captionPicked': 'pumili ng isa pang istasyon para kumpletuhin ang biyahe', 'hero.captionPlanned': 'naguhitan na ang biyahe mo sa network',
      'metric.places': 'destinasyon', 'metric.placesSub': 'mall, landmark, ospital',
      'linesShowcase.eyebrow': 'Anim na linya, isang lungsod',
      'linesShowcase.title1': 'Bawat linya', 'linesShowcase.title2': 'ay nagsasalaysay ng isang bahagi ng lungsod.',
      'linesShowcase.description': 'Mula airport sa hilaga hanggang Al-Hair sa timog, at mula King Saud University sa kanluran hanggang Khashm Al-An sa silangan — pumili ng linya at tingnan ang mga istasyon nito sa network.',
      'linesShowcase.explore': 'Ipakita sa diagram',
      'guideShowcase.eyebrow': 'Bago sumakay',
      'guideShowcase.title1': 'Unang biyahe?', 'guideShowcase.title2': 'Isang minuto, maiiwasan ang multa.',
      'guideShowcase.description': 'Ang limang karaniwang pagkakamali ng mga bagong mananakay. Nasa buong gabay ang mga multa, ang darb card at pagbabayad, at ang mga hakbang ng biyahe.',
      'guideShowcase.open': '📖 Buksan ang buong gabay', 'guideShowcase.quick': '⚡ Ang limang pagkakamali',
      'dataShowcase.eyebrow': 'Bukas sa mga developer',
      'dataShowcase.title1': 'Data ng network', 'dataShowcase.title2': 'sa mga format na tunay mong ginagamit.',
      'dataShowcase.description': 'Iisang pinagmulan ng datos na gumagawa ng site na ito: KML/KMZ para sa Google Earth at My Maps, GeoJSON, CSV at GPX para sa mapa at pagsusuri, at ang routable network file.',
      'dataShowcase.moreFile': 'Lahat ng file', 'dataShowcase.moreBody': 'Ang iba pang export, dokumentasyon at pinagmulan ay nasa GitHub.',
      'footer.nav': 'Mga link sa footer', 'top.back': 'Bumalik sa itaas'
    },
    fr: {
      'app.short': 'Métro de Riyad',
      'brand.home': '— accueil',
      'status.more': '— horaires et tarifs',
      'nav.lines': 'Lignes', 'nav.guide': 'Guide du voyageur', 'nav.data': 'Données ouvertes', 'nav.cta': 'Planifier un trajet',
      'hero.eyebrow': 'Réseau du métro de Riyad · projet communautaire ouvert',
      'hero.title1': 'Tout Riyad,', 'hero.title2': 'à une station.',
      'hero.description': "Saisissez une station ou un lieu — ou touchez deux stations sur le réseau : nous calculons l'itinéraire, les correspondances, la durée et le tarif, puis nous dessinons votre trajet sur la ligne.",
      'hero.builderKicker': 'Commencez ici', 'hero.builderTitle': "D'où à où ?",
      'hero.stageKicker': 'Réseau en direct', 'hero.stageTitle': 'Réseau du métro de Riyad', 'hero.stageOpen': 'Plan complet',
      'hero.railAria': 'Lignes du métro de Riyad', 'hero.scroll': 'Explorer le réseau',
      'hero.railStations': 'stations', 'hero.interchanges': 'correspondances',
      'hero.tapHint': 'Touchez une station du réseau pour commencer votre trajet',
      'hero.captionPicked': 'choisissez une autre station pour compléter le trajet', 'hero.captionPlanned': 'votre trajet est dessiné sur le réseau',
      'metric.places': 'destinations', 'metric.placesSub': 'centres commerciaux, hôpitaux, sites',
      'linesShowcase.eyebrow': 'Six lignes, une ville',
      'linesShowcase.title1': 'Chaque ligne', 'linesShowcase.title2': "raconte un axe de la ville.",
      'linesShowcase.description': "De l'aéroport au nord jusqu'à Al-Hair au sud, et de l'université King Saud à l'ouest jusqu'à Khashm Al-An à l'est — choisissez une ligne et voyez ses stations sur le réseau.",
      'linesShowcase.explore': 'Voir sur le plan',
      'guideShowcase.eyebrow': 'Avant de monter',
      'guideShowcase.title1': 'Premier trajet ?', 'guideShowcase.title2': 'Une minute vous évite une amende.',
      'guideShowcase.description': 'Les cinq erreurs les plus fréquentes des nouveaux voyageurs. Le guide complet détaille les amendes, la carte darb et les paiements, et les étapes du trajet de porte à porte.',
      'guideShowcase.open': '📖 Ouvrir le guide complet', 'guideShowcase.quick': '⚡ Les cinq erreurs',
      'dataShowcase.eyebrow': 'Ouvert aux développeurs',
      'dataShowcase.title1': 'Données du réseau', 'dataShowcase.title2': 'dans des formats réellement utilisables.',
      'dataShowcase.description': "La même source unique qui construit ce site : KML/KMZ pour Google Earth et My Maps, GeoJSON, CSV et GPX pour les cartes et l'analyse, et le fichier réseau routable.",
      'dataShowcase.moreFile': 'Tous les fichiers', 'dataShowcase.moreBody': 'Les autres exports, la documentation et les sources sont sur GitHub.',
      'footer.nav': 'Liens de pied de page', 'top.back': 'Retour en haut'
    },
    ru: {
      'app.short': 'Метро Эр-Рияда',
      'brand.home': '— на главную',
      'status.more': '— часы работы и тарифы',
      'nav.lines': 'Линии', 'nav.guide': 'Гид пассажира', 'nav.data': 'Открытые данные', 'nav.cta': 'Построить маршрут',
      'hero.eyebrow': 'Сеть метро Эр-Рияда · открытый общественный проект',
      'hero.title1': 'Весь Эр-Рияд —', 'hero.title2': 'в одной остановке.',
      'hero.description': 'Введите станцию или место либо коснитесь двух станций на схеме: мы рассчитаем маршрут, пересадки, время и стоимость, а затем нарисуем поездку прямо на линии.',
      'hero.builderKicker': 'Начните здесь', 'hero.builderTitle': 'Откуда и куда?',
      'hero.stageKicker': 'Сеть в реальном времени', 'hero.stageTitle': 'Сеть метро Эр-Рияда', 'hero.stageOpen': 'Полная схема',
      'hero.railAria': 'Линии метро Эр-Рияда', 'hero.scroll': 'Изучить сеть',
      'hero.railStations': 'станций', 'hero.interchanges': 'пересадок',
      'hero.tapHint': 'Нажмите любую станцию на схеме, чтобы начать поездку',
      'hero.captionPicked': 'выберите ещё одну станцию, чтобы завершить поездку', 'hero.captionPlanned': 'ваш маршрут нарисован на сети',
      'metric.places': 'мест', 'metric.placesSub': 'моллы, больницы, достопримечательности',
      'linesShowcase.eyebrow': 'Шесть линий, один город',
      'linesShowcase.title1': 'Каждая линия', 'linesShowcase.title2': 'рассказывает об одной оси города.',
      'linesShowcase.description': 'От аэропорта на севере до Аль-Хаира на юге и от Университета Короля Сауда на западе до Хашм-аль-Ана на востоке — выберите линию и посмотрите её станции на схеме.',
      'linesShowcase.explore': 'Показать на схеме',
      'guideShowcase.eyebrow': 'Перед поездкой',
      'guideShowcase.title1': 'Первая поездка?', 'guideShowcase.title2': 'Одна минута спасает от штрафа.',
      'guideShowcase.description': 'Пять самых частых ошибок новых пассажиров. В полном гиде — штрафы, карта darb и способы оплаты, а также шаги поездки от двери до двери.',
      'guideShowcase.open': '📖 Открыть полный гид', 'guideShowcase.quick': '⚡ Пять ошибок',
      'dataShowcase.eyebrow': 'Открыто для разработчиков',
      'dataShowcase.title1': 'Данные сети', 'dataShowcase.title2': 'в форматах, которые вам действительно нужны.',
      'dataShowcase.description': 'Тот же единый источник, из которого собирается сайт: KML/KMZ для Google Earth и My Maps, GeoJSON, CSV и GPX для карт и анализа, и файл маршрутизируемой сети.',
      'dataShowcase.moreFile': 'Все файлы', 'dataShowcase.moreBody': 'Остальные экспорты, документация и источники — на GitHub.',
      'footer.nav': 'Ссылки в подвале', 'top.back': 'Наверх'
    }
  };
  Object.keys(EXTRA).forEach(function (lang) {
    Object.keys(EXTRA[lang]).forEach(function (key) { I18N[lang][key] = EXTRA[lang][key]; });
  });

  return { LANGS: LANGS, DOW: DOW, I18N: I18N, TIPS: TIPS, GUIDE: GUIDE, FV_TIPS: FV_TIPS };
});
