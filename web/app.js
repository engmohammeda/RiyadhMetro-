/* Riyadh Metro Navigator — web app (vanilla JS + Leaflet)
 * Depends on: data/metro-data.js (window.RIYADH_METRO_DATA), lib/{geo,network,router,links,kml,geojson,schematic,service}.js
 *
 * Views:  🚇 schematic diagram (tap A, tap B → trip)  |  🗺️ geographic map (Leaflet)
 * Deep links:  #<from>~<to>~<lang>[~<mode>]   e.g. #al-batha~al-hamra~ar   #p:kingdom-centre~airport-t1-2~en
 *              <from>/<to> are station ids, or "p:<place-id>" for a destination; a single station (#kafd~~ar) opens its card.
 *              Legacy "#from=…&to=…&lang=…" and "#station=…" links keep working.
 */
(function () {
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
      'app.title': 'مترو الرياض — دليل التنقل',
      'app.subtitle': 'Riyadh Metro Navigator · 6 مسارات · 83 محطة',
      'top.kmz': '⬇ KMZ لـ Google Earth',
      'tab.plan': '🧭 خطّط رحلتك', 'tab.lines': '🚇 المسارات', 'tab.info': 'ℹ️ معلومات', 'tab.export': '🌍 Earth / Maps',
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
      'info.credits': 'استُلهمت تجربة الاستخدام (المخطط التفاعلي، اختيار المحطتين بالنقر، الروابط القصيرة، ساعات العمل والأسعار) من مشاريع مجتمعية مثل riyadhmetro.fyi — مع بيانات وشيفرة ورسوم مستقلة بالكامل.'
    },
    en: {
      'app.title': 'Riyadh Metro Navigator',
      'app.subtitle': 'مترو الرياض · 6 lines · 83 stations',
      'top.kmz': '⬇ KMZ for Google Earth',
      'tab.plan': '🧭 Plan a trip', 'tab.lines': '🚇 Lines', 'tab.info': 'ℹ️ Info', 'tab.export': '🌍 Earth / Maps',
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
      'info.credits': 'The user experience (interactive diagram, tap-to-plan, short links, hours & fares) is inspired by community projects such as riyadhmetro.fyi — with fully independent data, code and artwork.'
    },
    ur: {
      'app.title': 'ریاض میٹرو — سفر گائیڈ',
      'tab.plan': '🧭 سفر کی منصوبہ بندی', 'tab.lines': '🚇 لائنیں', 'tab.info': 'ℹ️ معلومات', 'tab.export': '🌍 Earth / Maps',
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
      'tab.plan': '🧭 यात्रा योजना', 'tab.lines': '🚇 लाइनें', 'tab.info': 'ℹ️ जानकारी', 'tab.export': '🌍 Earth / Maps',
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
      'tab.plan': '🧭 যাত্রা পরিকল্পনা', 'tab.lines': '🚇 লাইন', 'tab.info': 'ℹ️ তথ্য', 'tab.export': '🌍 Earth / Maps',
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
      'tab.plan': '🧭 Magplano', 'tab.lines': '🚇 Mga linya', 'tab.info': 'ℹ️ Impormasyon', 'tab.export': '🌍 Earth / Maps',
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
      'tab.plan': '🧭 Itinéraire', 'tab.lines': '🚇 Lignes', 'tab.info': 'ℹ️ Infos', 'tab.export': '🌍 Earth / Maps',
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
      'tab.plan': '🧭 Маршрут', 'tab.lines': '🚇 Линии', 'tab.info': 'ℹ️ Инфо', 'tab.export': '🌍 Earth / Maps',
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

  /* ----------------------------------------------------------------- state */
  var DATA = window.RIYADH_METRO_DATA;
  var NET = RMNetwork.buildNetwork(DATA);
  var CFG = DATA.config || {};
  var SITE = (CFG.project && CFG.project.siteUrl) || '';
  var storedLang = localStorage.getItem('rm.lang');
  var state = {
    lang: LANGS[storedLang] ? storedLang : 'ar',
    view: localStorage.getItem('rm.view') || 'diagram',
    from: null, fromPlace: null, to: null, toPlace: null,
    mode: 'fastest', depart: 'now',
    itineraries: [], activeIt: 0, timing: null,
    station: null,
    hidden: {}
  };
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  function t(key, vars) {
    var s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || I18N.ar[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function NL() { return LANGS[state.lang].names; }                 // language used for station/place names
  function OL() { return NL() === 'ar' ? 'en' : 'ar'; }             // the other one
  function isRtl() { return LANGS[state.lang].dir === 'rtl'; }
  function name(id) { return NET.stations[id].name[NL()]; }
  function altName(id) { return NET.stations[id].name[OL()]; }
  function pname(id) { return NET.places[id].name[NL()]; }
  function lname(id) { return NET.lines[id].name[NL()]; }
  function dow(i) { return (DOW[state.lang] || DOW.en)[i]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDist(m) { return RMGeo.formatDistance(m, NL()); }
  function isDark(line) { return line.id === '4'; }
  function badge(line, small) {
    return '<span class="badge' + (isDark(line) ? ' dark' : '') + '" style="background:' + line.color + '"><span class="num">' + line.number + '</span>' + (small ? '' : esc(line.name[NL()])) + '</span>';
  }
  function catIcon(p) { var c = NET.placeCategories[p.category]; return (c && c.icon) || '📍'; }
  function catName(p) { var c = NET.placeCategories[p.category]; return c ? (c[NL()] || c.en) : ''; }
  function hoursLabel(rule) {
    if (rule.label && rule.label[state.lang]) return rule.label[state.lang];
    var d = rule.days;
    return d.length === 1 ? dow(d[0]) : dow(d[0]) + ' – ' + dow(d[d.length - 1]);
  }
  function hoursSummary() {
    return ((CFG.service && CFG.service.hours) || []).map(function (r) { return hoursLabel(r) + ' ' + r.open + '–' + RMService.formatHM(RMService.parseHM(r.close)); }).join(' · ');
  }
  function arrow() { return isRtl() ? '←' : '→'; }

  /* ------------------------------------------------------------------- map */
  var map = L.map('map', { zoomControl: false, preferCanvas: false }).setView([24.72, 46.70], 11);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
  var baseLayers = {
    map: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>' }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics' })
  };
  var baseOrder = ['light', 'map', 'sat'], baseIdx = 0;
  baseLayers[baseOrder[baseIdx]].addTo(map);

  var networkLayer = L.layerGroup().addTo(map);
  var routeLayer = L.layerGroup().addTo(map);
  var labelLayer = L.layerGroup().addTo(map);
  var userLayer = L.layerGroup().addTo(map);
  var placeLayer = L.layerGroup().addTo(map);
  var lineLayers = {}, stationMarkers = {};
  var mapReady = false;

  function drawNetwork() {
    networkLayer.clearLayers();
    lineLayers = {}; stationMarkers = {};
    NET.lineOrder.forEach(function (lid) {
      var line = NET.lines[lid];
      var g = L.layerGroup();
      L.polyline(line.shape, { color: '#fff', weight: 9, opacity: 0.9, lineJoin: 'round' }).addTo(g);
      var pl = L.polyline(line.shape, { color: line.color, weight: 5.5, opacity: 0.95, lineJoin: 'round' }).addTo(g);
      pl.bindTooltip(line.number + ' — ' + line.name.ar + ' • ' + line.name.en, { sticky: true, className: 'station-label' });
      pl.on('click', function () { showLineOnMap(lid, true); });
      lineLayers[lid] = g;
      if (!state.hidden[lid]) g.addTo(networkLayer);
    });
    Object.keys(NET.stations).forEach(function (id) {
      var s = NET.stations[id];
      var color = NET.lines[s.lines[0]].color;
      var m = L.circleMarker([s.lat, s.lng], s.interchange
        ? { radius: 8, color: '#1f1f1f', weight: 3, fillColor: '#fff', fillOpacity: 1 }
        : { radius: 6, color: '#fff', weight: 2.5, fillColor: color, fillOpacity: 1 });
      m.bindTooltip(s.name.ar + ' • ' + s.name.en, { direction: 'top', offset: [0, -6], className: 'station-label' });
      m.on('click', function () { selectStation(id, true); });
      m.stationId = id;
      stationMarkers[id] = m;
      m.addTo(networkLayer);
    });
    updateLabels();
  }

  function updateLabels() {
    labelLayer.clearLayers();
    var z = map.getZoom();
    if (z < 13) return;
    var b = map.getBounds().pad(0.1);
    Object.keys(NET.stations).forEach(function (id) {
      var s = NET.stations[id];
      if (!b.contains([s.lat, s.lng])) return;
      if (z < 14 && !s.interchange) return;
      if (s.lines.every(function (l) { return state.hidden[l]; })) return;
      L.tooltip({ permanent: true, direction: 'right', offset: [10, 0], className: 'station-label', interactive: false })
        .setLatLng([s.lat, s.lng]).setContent(s.name[NL()]).addTo(labelLayer);
    });
  }
  map.on('zoomend moveend', updateLabels);

  function networkBounds() {
    var pts = [];
    NET.lineOrder.forEach(function (l) { pts = pts.concat(NET.lines[l].shape); });
    return L.latLngBounds(pts);
  }
  function fitNetwork() {
    if (state.view === 'map') map.fitBounds(networkBounds(), { padding: [20, 20] });
    else if (SCH.pz) SCH.pz.fit(true);
  }

  function setLineVisible(lid, visible) {
    state.hidden[lid] = !visible;
    if (visible) lineLayers[lid].addTo(networkLayer); else networkLayer.removeLayer(lineLayers[lid]);
    Object.keys(stationMarkers).forEach(function (id) {
      var s = NET.stations[id];
      var anyVisible = s.lines.some(function (l) { return !state.hidden[l]; });
      if (anyVisible) stationMarkers[id].addTo(networkLayer); else networkLayer.removeLayer(stationMarkers[id]);
    });
    updateLabels();
    if (SCH.svgEl) $$('#sch-svg .l[data-line]').forEach(function (g) { g.style.display = state.hidden[g.dataset.line] ? 'none' : ''; });
  }

  function showLineOnMap(lid, openList) {
    if (state.view === 'map') map.fitBounds(L.latLngBounds(NET.lines[lid].shape), { padding: [30, 30] });
    else if (SCH.pz) SCH.pz.fitStations(NET.lines[lid].stations, 40);
    if (openList) {
      switchTab('lines');
      $$('.line-item').forEach(function (el) { el.classList.toggle('open', el.dataset.line === lid); });
      var el = document.querySelector('.line-item[data-line="' + lid + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function dimNetwork(dim) {
    NET.lineOrder.forEach(function (lid) {
      lineLayers[lid].eachLayer(function (l) { l.setStyle({ opacity: dim ? 0.18 : (l.options.color === '#fff' ? 0.9 : 0.95) }); });
    });
    Object.keys(stationMarkers).forEach(function (id) { stationMarkers[id].setStyle({ opacity: dim ? 0.25 : 1, fillOpacity: dim ? 0.25 : 1 }); });
  }

  function placeMarker(pid, color) {
    var p = NET.places[pid];
    return L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: 'place-pin', html: '<span style="border-color:' + color + '">' + catIcon(p) + '</span>', iconSize: [30, 30], iconAnchor: [15, 30] })
    }).bindTooltip(p.name[NL()], { direction: 'top', offset: [0, -28], className: 'station-label' });
  }

  /* --------------------------------------------------------- diagram view */
  var SCH = { model: null, svgEl: null, pz: null, lang: null, fitted: false, hintSeen: false };

  /** Minimal pan/zoom for the inline SVG (mouse, wheel, touch pinch, buttons). */
  function PanZoom(viewport, canvas, w, h) {
    var self = this;
    this.vp = viewport; this.cv = canvas; this.w = w; this.h = h;
    this.s = 1; this.tx = 0; this.ty = 0; this.min = 0.15; this.max = 6; this.moved = false;
    var pointers = {}, startDist = 0, startScale = 1, lastMid = null, downPos = null, travel = 0;
    function pts() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      viewport.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p = pts();
      if (p.length === 1) { downPos = { x: e.clientX, y: e.clientY }; travel = 0; self.moved = false; lastMid = { x: e.clientX, y: e.clientY }; }
      if (p.length === 2) { startDist = dist(p[0], p[1]); startScale = self.s; lastMid = mid(p[0], p[1]); }
      canvas.classList.remove('anim');
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var p = pts();
      if (p.length === 1) {
        var dx = p[0].x - lastMid.x, dy = p[0].y - lastMid.y;
        travel += Math.abs(dx) + Math.abs(dy);
        if (travel > 6) self.moved = true;
        self.tx += dx; self.ty += dy; lastMid = { x: p[0].x, y: p[0].y }; self.apply();
      } else if (p.length === 2) {
        self.moved = true;
        var m = mid(p[0], p[1]), d = dist(p[0], p[1]);
        var r = viewport.getBoundingClientRect();
        var factor = (startScale * (d / (startDist || d))) / self.s;
        self.zoomAt(factor, m.x - r.left, m.y - r.top, false);
        self.tx += m.x - lastMid.x; self.ty += m.y - lastMid.y; lastMid = m; self.apply();
      }
    });
    function up(e) {
      delete pointers[e.pointerId];
      var p = pts();
      if (p.length === 1) { lastMid = { x: p[0].x, y: p[0].y }; }
      if (!p.length) setTimeout(function () { self.moved = false; }, 0);
    }
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = viewport.getBoundingClientRect();
      var delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
      self.zoomAt(Math.exp(-delta * 0.0015), e.clientX - r.left, e.clientY - r.top, false);
    }, { passive: false });
    viewport.addEventListener('dblclick', function (e) {
      var r = viewport.getBoundingClientRect();
      self.zoomAt(1.7, e.clientX - r.left, e.clientY - r.top, true);
    });
  }
  PanZoom.prototype.apply = function () {
    this.cv.style.transform = 'translate(' + this.tx.toFixed(2) + 'px,' + this.ty.toFixed(2) + 'px) scale(' + this.s.toFixed(4) + ')';
  };
  PanZoom.prototype.zoomAt = function (factor, cx, cy, animate) {
    var ns = Math.min(this.max, Math.max(this.min, this.s * factor));
    factor = ns / this.s;
    this.tx = cx - (cx - this.tx) * factor; this.ty = cy - (cy - this.ty) * factor; this.s = ns;
    this.cv.classList.toggle('anim', !!animate);
    this.apply();
  };
  PanZoom.prototype.fit = function (animate) {
    var vw = this.vp.clientWidth, vh = this.vp.clientHeight;
    if (!vw || !vh) return;
    this.s = Math.min(this.max, Math.max(this.min, Math.min(vw / this.w, vh / this.h) * 0.98));
    this.tx = (vw - this.w * this.s) / 2; this.ty = (vh - this.h * this.s) / 2;
    this.cv.classList.toggle('anim', !!animate);
    this.apply();
  };
  PanZoom.prototype.fitBox = function (x0, y0, x1, y1, pad, animate) {
    var vw = this.vp.clientWidth, vh = this.vp.clientHeight;
    if (!vw || !vh) return;
    pad = pad || 40;
    var bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    var s = Math.min((vw - 2 * pad) / bw, (vh - 2 * pad) / bh);
    this.s = Math.min(2.2, Math.max(this.min, s));
    this.tx = (vw - bw * this.s) / 2 - x0 * this.s; this.ty = (vh - bh * this.s) / 2 - y0 * this.s;
    this.cv.classList.toggle('anim', !!animate);
    this.apply();
  };
  PanZoom.prototype.fitStations = function (ids, pad) {
    var m = SCH.model, xs = [], ys = [];
    ids.forEach(function (id) { var st = m.stations[id]; if (st) { xs.push(st.x); ys.push(st.y); } });
    if (!xs.length) return;
    var u = m.unit;
    this.fitBox(Math.min.apply(null, xs) - u, Math.min.apply(null, ys) - u, Math.max.apply(null, xs) + u, Math.max.apply(null, ys) + u, pad || 60, true);
  };

  function buildDiagram(force) {
    if (!DATA.schematic || !window.RMSchematic) return;
    if (!SCH.model) SCH.model = RMSchematic.build(NET, DATA.schematic);
    var lang = NL();
    if (!force && SCH.svgEl && SCH.lang === lang) return;
    var canvas = $('#sch-canvas');
    canvas.innerHTML = RMSchematic.svg(SCH.model, { lang: lang, interactive: true, id: 'sch-svg' });
    canvas.style.width = SCH.model.width + 'px'; canvas.style.height = SCH.model.height + 'px';
    SCH.svgEl = $('#sch-svg'); SCH.lang = lang;
    if (!SCH.pz) {
      SCH.pz = new PanZoom($('#sch-viewport'), canvas, SCH.model.width, SCH.model.height);
      window.addEventListener('resize', function () { if (state.view === 'diagram' && !state.itineraries.length) SCH.pz.fit(false); });
    }
    SCH.svgEl.addEventListener('click', function (e) {
      if (SCH.pz.moved) return;
      var el = e.target.closest ? e.target.closest('[data-st]') : null;
      if (el) onDiagramTap(el.getAttribute('data-st'));
    });
    SCH.svgEl.addEventListener('pointerover', function (e) {
      var el = e.target.closest ? e.target.closest('[data-st]') : null;
      $$('#sch-svg .s.hover').forEach(function (g) { g.classList.remove('hover'); });
      if (el) { var g = SCH.svgEl.querySelector('.s[data-st="' + el.getAttribute('data-st') + '"]'); if (g) g.classList.add('hover'); }
    });
    NET.lineOrder.forEach(function (lid) { if (state.hidden[lid]) { var g = SCH.svgEl.querySelector('.l[data-line="' + lid + '"]'); if (g) g.style.display = 'none'; } });
    drawDiagramMarkers();
  }

  function onDiagramTap(id) {
    SCH.hintSeen = true;
    if (!state.from && state.to && state.to !== id) {
      // destination was chosen first (e.g. from the destinations list): this tap is the origin
      setFrom(id, null);
      plan();
    } else if (!state.from || state.to) {
      // first tap (or a tap after a finished trip) starts a new trip from here
      state.itineraries = []; state.activeIt = 0;
      $('#result').innerHTML = ''; $('#popular').style.display = '';
      routeLayer.clearLayers(); dimNetwork(false); $('#btn-clear').style.display = '';
      setTo(null, null); setFrom(id, null);
      state.station = id; renderStationCard(id);
      showSchHint(t('sch.pickB', { s: name(id) }), true);
      switchTab('plan');
    } else if (state.from === id) {
      toast(t('err.same'));
    } else {
      setTo(id, null);
      plan();
    }
    drawDiagramMarkers();
    updateHash();
  }

  function showSchHint(text, cancellable) {
    var el = $('#sch-hint');
    el.hidden = false;
    el.innerHTML = '<span>' + esc(text) + '</span>' + (cancellable ? '<button id="sch-hint-x" title="' + esc(t('sch.cancel')) + '">✕</button>' : '');
    if (cancellable) $('#sch-hint-x').addEventListener('click', function () { setFrom(null, null); setTo(null, null); clearRoute(); $('#station-card').innerHTML = ''; state.station = null; hideSchHint(); drawDiagramMarkers(); });
  }
  function hideSchHint() { $('#sch-hint').hidden = true; }
  function refreshSchHint() {
    if (state.view !== 'diagram') { hideSchHint(); return; }
    if (state.itineraries.length) hideSchHint();
    else if (state.from && !state.to) showSchHint(t('sch.pickB', { s: name(state.from) }), true);
    else if (!SCH.hintSeen) showSchHint(t('sch.tapHint'), false);
    else hideSchHint();
  }

  function abMarker(id, color, letter) {
    var st = SCH.model.stations[id];
    if (!st) return '';
    var u = SCH.model.unit;
    return '<circle cx="' + st.x + '" cy="' + st.y + '" r="' + (0.36 * u) + '" fill="' + color + '" stroke="#fff" stroke-width="3"/>' +
      '<text class="ab" x="' + st.x + '" y="' + (st.y + 0.13 * u) + '" font-size="' + (0.36 * u) + '">' + letter + '</text>';
  }

  function drawDiagramMarkers() {
    if (!SCH.svgEl) return;
    var it = state.itineraries[state.activeIt];
    var overlay = SCH.svgEl.querySelector('#sch-route'), net = SCH.svgEl.querySelector('#sch-net');
    $$('#sch-svg .on').forEach(function (el) { el.classList.remove('on'); });
    if (it) {
      overlay.innerHTML = RMSchematic.routeOverlay(SCH.model, it, NL());
      net.classList.add('dim');
      var ids = {};
      it.legs.forEach(function (leg) { leg.stations.forEach(function (id) { ids[id] = 1; }); });
      Object.keys(ids).forEach(function (id) {
        $$('#sch-svg [data-st="' + id + '"]').forEach(function (el) { el.classList.add('on'); });
      });
    } else {
      net.classList.remove('dim');
      overlay.innerHTML = (state.from ? abMarker(state.from, '#16a34a', 'A') : '') + (state.to ? abMarker(state.to, '#dc2626', 'B') : '');
    }
    refreshSchHint();
  }

  function setView(v, keepFit) {
    state.view = v;
    localStorage.setItem('rm.view', v);
    $('#map').hidden = v !== 'map';
    $('#diagram').hidden = v !== 'diagram';
    $('.stage').classList.toggle('is-diagram', v === 'diagram');
    $$('.view-switch button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    $('#btn-basemap').style.display = v === 'map' ? '' : 'none';
    var it = state.itineraries[state.activeIt];
    if (v === 'map') {
      setTimeout(function () {
        map.invalidateSize();
        if (!mapReady) { mapReady = true; if (!it) fitNetwork(); }
        if (it && !keepFit) fitRouteOnMap(it);
      }, 30);
      hideSchHint();
    } else {
      buildDiagram();
      requestAnimationFrame(function () {
        if (it && !keepFit) SCH.pz.fitStations(routeStations(it), 50);
        else if (!SCH.fitted) { SCH.pz.fit(false); SCH.fitted = true; }
        refreshSchHint();
      });
    }
  }

  /* -------------------------------------------------------------- planner */
  function suggestionHtml(r) {
    if (r.kind === 'station') {
      var s = r.item;
      return '<div data-kind="station" data-id="' + s.id + '">' + s.lines.map(function (l) { return badge(NET.lines[l], true); }).join('') +
        '<span>' + esc(s.name[NL()]) + '</span><small>' + esc(s.name[OL()]) + '</small></div>';
    }
    var p = r.item, st = NET.stations[p.station], n = p.nearest[0];
    return '<div data-kind="place" data-id="' + p.id + '"><span class="pico">' + catIcon(p) + '</span>' +
      '<span>' + esc(p.name[NL()]) + '<small class="sub">' + esc(catName(p)) + ' · ' + esc(t('place.near')) + ': ' + esc(st.name[NL()]) + ' · ' + fmtDist(n.distanceM) + '</small></span>' +
      '<small>' + st.lines.map(function (l) { return badge(NET.lines[l], true); }).join('') + '</small></div>';
  }

  function setupSuggest(input, box, onPick) {
    var active = -1, items = [];
    function render(list) {
      items = list;
      active = -1;
      if (!list.length) { box.classList.remove('open'); box.innerHTML = ''; return; }
      box.innerHTML = list.map(suggestionHtml).join('');
      box.classList.add('open');
      $$('#' + box.id + ' > div').forEach(function (el, i) { el.addEventListener('mousedown', function (e) { e.preventDefault(); pick(items[i]); }); });
    }
    function pick(r) { onPick(r); box.classList.remove('open'); }
    function search() { input.dataset.id = ''; input.dataset.place = ''; render(RMNetwork.searchAll(NET, input.value, 8)); }
    input.addEventListener('input', search);
    input.addEventListener('focus', function () { if (input.value && !input.dataset.id) render(RMNetwork.searchAll(NET, input.value, 8)); });
    input.addEventListener('blur', function () { setTimeout(function () { box.classList.remove('open'); }, 150); });
    input.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) { if (e.key === 'Enter') plan(); return; }
      var els = $$('#' + box.id + ' > div');
      if (e.key === 'ArrowDown') { active = Math.min(els.length - 1, active + 1); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(items[active >= 0 ? active : 0]); return; }
      else if (e.key === 'Escape') { box.classList.remove('open'); return; }
      else return;
      e.preventDefault();
      els.forEach(function (el, i) { el.classList.toggle('active', i === active); });
    });
  }

  function fillInput(input, st, pl) {
    input.value = pl ? pname(pl) : (st ? name(st) : '');
    input.dataset.id = st || ''; input.dataset.place = pl || '';
  }
  function setFrom(st, pl) { state.from = st || null; state.fromPlace = pl || null; fillInput($('#from'), state.from, state.fromPlace); }
  function setTo(st, pl) { state.to = st || null; state.toPlace = pl || null; fillInput($('#to'), state.to, state.toPlace); }
  function pickToRef(r) { return r.kind === 'place' ? { station: r.station, place: r.id } : { station: r.id, place: null }; }

  function resolveInput(input) {
    if (input.dataset.id && NET.stations[input.dataset.id]) {
      return { station: input.dataset.id, place: input.dataset.place && NET.places[input.dataset.place] ? input.dataset.place : null };
    }
    var q = input.value.trim();
    if (!q) return null;
    var r = RMNetwork.searchAll(NET, q, 1);
    return r.length ? pickToRef(r[0]) : { unknown: q };
  }

  function plan(fromHash) {
    var A = resolveInput($('#from')), B = resolveInput($('#to'));
    var res = $('#result');
    if (!A || !B) { res.innerHTML = '<div class="error">' + t('err.pick') + '</div>'; return; }
    if (A.unknown) { res.innerHTML = '<div class="error">' + t('err.unknown') + esc(A.unknown) + '</div>'; return; }
    if (B.unknown) { res.innerHTML = '<div class="error">' + t('err.unknown') + esc(B.unknown) + '</div>'; return; }
    setFrom(A.station, A.place); setTo(B.station, B.place);
    if (A.station === B.station) {
      res.innerHTML = '<div class="error">' + ((A.place || B.place) ? t('err.samePlace', { s: name(A.station) }) : t('err.same')) + '</div>';
      drawDiagramMarkers();
      return;
    }
    state.mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'fastest';
    state.depart = $('#depart').value || 'now';
    var its = RMRouter.planAlternatives(NET, A.station, B.station);
    its.sort(function (a, b) { return (a.mode === state.mode ? 0 : 1) - (b.mode === state.mode ? 0 : 1); });
    state.itineraries = its; state.activeIt = 0; state.station = null;
    $('#station-card').innerHTML = ''; $('#nearby').innerHTML = '';
    renderItinerary();
    updateHash();                       // normalises legacy links to the short #from~to~lang form
    switchTab('plan');
    collapsePanel(false);
    if (!fromHash) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function walkLeg(placeId, stationId) {
    if (!placeId) return null;
    var p = NET.places[placeId];
    var n = p.nearest.filter(function (x) { return x.station === stationId; })[0];
    if (!n) {
      var st = NET.stations[stationId], d = Math.round(RMGeo.haversine([p.lat, p.lng], [st.lat, st.lng]));
      n = { station: stationId, distanceM: d, walkMinutes: Math.max(1, Math.round(d / 75)) };
    }
    return { place: p, station: stationId, distanceM: n.distanceM, walkMinutes: n.walkMinutes };
  }
  function routeStations(it) {
    var ids = [];
    it.legs.forEach(function (leg) { ids = ids.concat(leg.stations); });
    return ids;
  }

  function renderItinerary() {
    var it = state.itineraries[state.activeIt];
    var res = $('#result');
    if (!it) { res.innerHTML = ''; drawRoute(null); $('#popular').style.display = ''; return; }
    $('#popular').style.display = 'none';
    var from = NET.stations[it.from], to = NET.stations[it.to];
    var wf = walkLeg(state.fromPlace, it.from), wt = walkLeg(state.toPlace, it.to);
    var walkMin = (wf ? wf.walkMinutes : 0) + (wt ? wt.walkMinutes : 0);
    var now = RMService.riyadhNow();
    var dep = RMService.parseDeparture(state.depart, now);
    var timing = RMService.tripTiming(CFG, dep, it.totalMinutes + walkMin, now);
    state.timing = timing;
    var fare = RMService.fareFor(CFG, it.totalMinutes);
    var total = it.totalMinutes + walkMin + timing.waitMinutes;
    var fromLabel = wf ? wf.place.name[NL()] : from.name[NL()], toLabel = wt ? wt.place.name[NL()] : to.name[NL()];
    var ar = state.lang === 'ar';

    var html = '<div class="card result">' +
      '<div class="res-head"><h2>' + t('res.title') + '</h2><button class="btn small ghost" id="btn-new">✨ ' + t('plan.new') + '</button></div>' +
      '<div class="res-od"><span class="abm a">A</span> ' + esc(fromLabel) + ' <span class="arrow">' + arrow() + '</span> <span class="abm b">B</span> ' + esc(toLabel) + '</div>';
    if (state.itineraries.length > 1) {
      html += '<div class="alts">' + state.itineraries.map(function (x, i) {
        return '<button data-i="' + i + '" class="' + (i === state.activeIt ? 'active' : '') + '">' + t(x.mode === 'fastest' ? 'res.alt.fastest' : 'res.alt.fewest') +
          ' · ' + x.totalMinutes + ' ' + t('min') + ' · ' + x.transferCount + ' ' + t('res.transfers') + '</button>';
      }).join('') + '</div>';
    }
    html += '<div class="summary">' +
      '<div><b>' + total + '</b><small>' + t('res.min') + '</small></div>' +
      '<div><b>' + it.stops + '</b><small>' + t('res.stops') + '</small></div>' +
      '<div><b>' + it.transferCount + '</b><small>' + (it.transferCount ? t('res.transfers') : t('res.none')) + '</small></div></div>';

    // clock times + fare
    html += '<div class="times"><span class="tm">🕒 <b>' + t('res.depart') + '</b> ' + timing.departAt + ' <span class="arrow">' + arrow() + '</span> <b>' + t('res.arrive') + '</b> ~' + timing.arriveAt + '</span>' +
      (timing.waitMinutes ? '<small>' + t('res.wait', { n: timing.waitMinutes }) + '</small>' : '') + '</div>';
    if (fare) {
      html += '<div class="fare">🎫 <b>' + esc(fare.ticket.name[state.lang] || fare.ticket.name.en) + '</b>: ' + fare.standard + ' ' + t('res.sar') +
        (fare.first ? ' <span class="muted">· ' + t('res.firstClass') + ' ' + fare.first + ' ' + t('res.sar') + '</span>' : '') +
        ' <span class="muted">· ' + t('res.distance') + ' ' + fmtDist(it.totalDistanceM) + '</span></div>';
    }
    timing.warnings.forEach(function (w) {
      html += '<div class="' + (w === 'late' || w === 'closed' ? 'error' : 'notice') + '">⚠️ ' + t('warn.' + w, { t: w === 'closed' ? timing.opensAt : timing.closesAt }) + '</div>';
    });

    html += '<ol class="timeline">';
    if (wf) {
      html += '<li class="leg walk"><span class="pin walk"></span><div class="where">' + catIcon(wf.place) + ' ' + esc(wf.place.name[NL()]) + '<small>' + esc(wf.place.name[OL()]) + '</small></div>' +
        '<div class="what">🚶 ' + esc(t('res.walkFrom', { d: fmtDist(wf.distanceM), n: wf.walkMinutes, p: wf.place.name[NL()], s: from.name[NL()] })) + '</div></li>';
    }
    html += '<li class="leg" style="--leg-color:' + NET.lines[it.legs[0].line].color + '"><span class="pin start"></span>' +
      '<div class="where">' + esc(from.name[NL()]) + '<small>' + esc(altName(from.id)) + '</small></div>' +
      '<div class="what">' + legText(it.legs[0]) + '</div>' + stopsDetails(it.legs[0]) + '</li>';
    it.legs.forEach(function (leg, i) {
      if (i < it.legs.length - 1) {
        var next = it.legs[i + 1], tr = it.transfers[i];
        html += '<li class="leg" style="--leg-color:' + NET.lines[next.line].color + '"><span class="pin transfer"></span>' +
          '<div class="where">' + esc(name(leg.to)) + '<small>' + esc(altName(leg.to)) + '</small></div>' +
          '<div class="transfer-note">🔁 ' + t('res.change') + ' ' + badge(NET.lines[next.line]) + ' · ' + t('res.transferTime') + ' ' + tr.minutes + ' ' + t('min') + '</div>' +
          '<div class="what">' + legText(next) + '</div>' + stopsDetails(next) + '</li>';
      }
    });
    html += '<li class="leg' + (wt ? '' : ' last') + '"><span class="pin end"></span><div class="where">' + esc(to.name[NL()]) + '<small>' + esc(altName(to.id)) + '</small></div>' +
      '<div class="what">' + t('res.end') + ' — ' + t('res.alight') + ' ' + esc(to.name[NL()]) + '</div></li>';
    if (wt) {
      html += '<li class="leg walk last"><span class="pin walk"></span><div class="where">' + catIcon(wt.place) + ' ' + esc(wt.place.name[NL()]) + '<small>' + esc(wt.place.name[OL()]) + '</small></div>' +
        '<div class="what">🚶 ' + esc(t('res.walkTo', { d: fmtDist(wt.distanceM), n: wt.walkMinutes, p: wt.place.name[NL()] })) + '</div></li>';
    }
    html += '</ol>';

    var o = wf ? [wf.place.lat, wf.place.lng] : [from.lat, from.lng], d = wt ? [wt.place.lat, wt.place.lng] : [to.lat, to.lng];
    var gm = RMLinks.googleMapsDirections({ origin: o, destination: d, travelmode: 'transit' });
    html += '<div class="btn-row">' +
      '<a class="btn" target="_blank" rel="noopener" href="' + gm + '">🗺️ ' + t('res.gmaps') + '</a>' +
      '<button class="btn" id="btn-kml">🌍 ' + t('res.kml') + '</button>' +
      '<button class="btn small" id="btn-gj">{ } ' + t('res.geojson') + '</button>' +
      '<button class="btn small" id="btn-share">🔗 ' + t('res.share') + '</button>' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleEarth(from.lat, from.lng, { range: 2500, tilt: 55 }) + '">🌐 ' + t('res.earth') + '</a>' +
      '</div><p class="notice soft">' + esc(t('res.est', { h: hoursSummary() })) + (CFG.service && CFG.service.note && ar ? ' ' + esc(CFG.service.note.ar) : '') + '</p></div>';
    res.innerHTML = html;

    $$('.alts button').forEach(function (b) { b.addEventListener('click', function () { state.activeIt = +b.dataset.i; renderItinerary(); }); });
    $('#btn-new').addEventListener('click', function () { setFrom(null, null); setTo(null, null); clearRoute(); $('#from').focus(); });
    $('#btn-kml').addEventListener('click', function () { downloadRouteKml(it); });
    $('#btn-gj').addEventListener('click', function () {
      download('riyadh-metro-route-' + it.from + '-' + it.to + '.geojson', JSON.stringify(RMGeoJson.routeGeoJson(NET, it), null, 1), 'application/geo+json');
    });
    $('#btn-share').addEventListener('click', function () { copy(shareUrl()); toast(t('toast.copied')); });
    drawRoute(it);
  }

  function legText(leg) {
    var line = NET.lines[leg.line];
    var ar = state.lang === 'ar';
    var stopsTxt = ar ? RMRouter.arCount(leg.stops, RMRouter.AR_FORMS.stations) : leg.stops + ' ' + (state.lang === 'en' && leg.stops === 1 ? 'stop' : t('res.stops'));
    var minTxt = ar ? RMRouter.arCount(Math.max(1, leg.minutes), RMRouter.AR_FORMS.minutes) : '~' + Math.max(1, leg.minutes) + ' ' + t('min');
    return t('res.board') + ' ' + badge(line) + ' ' + t('res.towards') + ' <b>' + esc(name(leg.direction)) + '</b><br>' +
      stopsTxt + ' · ' + minTxt + ' · ' + fmtDist(leg.distanceM) + '<br>' + t('res.alight') + ' <b>' + esc(name(leg.to)) + '</b>';
  }
  function stopsDetails(leg) {
    if (leg.stations.length <= 2) return '';
    return '<details><summary>' + t('res.showStops') + ' (' + (leg.stations.length - 2) + ')</summary><ol>' +
      leg.stations.slice(1, -1).map(function (id) { return '<li>' + esc(name(id)) + (NET.stations[id].interchange ? ' <span class="chip x">⇄</span>' : '') + '</li>'; }).join('') + '</ol></details>';
  }

  function fitRouteOnMap(it) {
    var all = [];
    it.legs.forEach(function (leg) { all = all.concat(leg.geometry); });
    if (state.fromPlace) all.push([NET.places[state.fromPlace].lat, NET.places[state.fromPlace].lng]);
    if (state.toPlace) all.push([NET.places[state.toPlace].lat, NET.places[state.toPlace].lng]);
    var isMobile = window.innerWidth <= 860;
    map.fitBounds(L.latLngBounds(all), { padding: isMobile ? [30, 30] : [60, 60] });
  }

  function drawRoute(it) {
    routeLayer.clearLayers(); placeLayer.clearLayers();
    $('#btn-clear').style.display = it ? '' : 'none';
    if (!it) { dimNetwork(false); drawDiagramMarkers(); return; }
    dimNetwork(true);
    it.legs.forEach(function (leg) {
      var line = NET.lines[leg.line];
      L.polyline(leg.geometry, { color: '#fff', weight: 13, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
      L.polyline(leg.geometry, { color: line.color, weight: 8, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
      leg.stations.slice(1, -1).forEach(function (id) {
        var s = NET.stations[id];
        L.circleMarker([s.lat, s.lng], { radius: 5, color: '#fff', weight: 2, fillColor: line.color, fillOpacity: 1 })
          .bindTooltip(s.name[NL()], { direction: 'top', className: 'station-label' }).on('click', function () { selectStation(id, false); }).addTo(routeLayer);
      });
    });
    it.transfers.forEach(function (tr) {
      var s = NET.stations[tr.station];
      L.circleMarker([s.lat, s.lng], { radius: 10, color: '#1f1f1f', weight: 4, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip('🔁 ' + s.name[NL()], { permanent: true, direction: 'top', offset: [0, -10], className: 'station-label' }).addTo(routeLayer);
    });
    var f = NET.stations[it.from], e = NET.stations[it.to];
    L.circleMarker([f.lat, f.lng], { radius: 11, color: '#fff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 })
      .bindTooltip('A · ' + f.name[NL()], { permanent: true, direction: 'top', offset: [0, -10], className: 'station-label' }).addTo(routeLayer);
    L.circleMarker([e.lat, e.lng], { radius: 11, color: '#fff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 })
      .bindTooltip('B · ' + e.name[NL()], { permanent: true, direction: 'top', offset: [0, -10], className: 'station-label' }).addTo(routeLayer);
    [[state.fromPlace, f, '#16a34a'], [state.toPlace, e, '#dc2626']].forEach(function (x) {
      if (!x[0]) return;
      var p = NET.places[x[0]];
      L.polyline([[p.lat, p.lng], [x[1].lat, x[1].lng]], { color: x[2], weight: 3, dashArray: '4 6', opacity: 0.9 }).addTo(placeLayer);
      placeMarker(x[0], x[2]).addTo(placeLayer);
    });
    if (state.view === 'map') fitRouteOnMap(it);
    drawDiagramMarkers();
    if (state.view === 'diagram' && SCH.pz) SCH.pz.fitStations(routeStations(it), 50);
  }

  function clearRoute() {
    state.itineraries = []; state.activeIt = 0; state.timing = null;
    $('#result').innerHTML = '';
    $('#popular').style.display = '';
    drawRoute(null);
    updateHash();
  }

  function downloadRouteKml(it) {
    var steps = RMRouter.describeItinerary(NET, it, NL());
    var xml = RMKml.routeKml(NET, it, { siteUrl: SITE, repoUrl: CFG.project && CFG.project.repoUrl, steps: steps, lang: NL() });
    download('riyadh-metro-route-' + it.from + '-' + it.to + '.kml', xml, 'application/vnd.google-earth.kml+xml');
    toast(t('toast.kml'));
  }

  /* ------------------------------------------------------- popular trips */
  function renderPopular() {
    var trips = CFG.popularTrips || [];
    if (!trips.length) { $('#popular').innerHTML = ''; return; }
    $('#popular').innerHTML = '<div class="popular"><div class="section-title" style="margin-top:12px">⭐ ' + t('plan.popular') + '</div><div class="chips">' +
      trips.map(function (tr, i) {
        var label = tr.label && tr.label[state.lang] ? tr.label[state.lang] : name(tr.from) + ' ' + arrow() + ' ' + name(tr.to);
        return '<button class="chip-btn" data-i="' + i + '">' + esc(label) + '</button>';
      }).join('') + '</div></div>';
    $$('#popular .chip-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var tr = trips[+b.dataset.i];
        setFrom(tr.from, null); setTo(tr.to, null); plan();
      });
    });
  }

  /* --------------------------------------------------------- station card */
  function selectStation(id, openCard) {
    state.station = id;
    var s = NET.stations[id];
    var popup = '<div class="pname">' + esc(s.name[NL()]) + '<small>' + esc(altName(id)) + '</small></div>' +
      '<div>' + s.lines.map(function (l) { return badge(NET.lines[l]); }).join(' ') + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn small" data-act="from">🟢 ' + t('st.fromHere') + '</button>' +
      '<button class="btn small" data-act="to">🔴 ' + t('st.toHere') + '</button>' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleMapsPlace(s.lat, s.lng) + '">📌 ' + t('st.gmaps') + '</a>' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleEarth(s.lat, s.lng) + '">🌍 Earth</a>' +
      '</div>';
    var p = L.popup({ offset: [0, -6], autoPanPadding: [40, 40] }).setLatLng([s.lat, s.lng]).setContent(popup).openOn(map);
    setTimeout(function () {
      $$('.leaflet-popup button[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.act === 'from') setFrom(id, null); else setTo(id, null);
          map.closePopup(p);
          if (state.from && state.to) plan(); else { switchTab('plan'); collapsePanel(false); drawDiagramMarkers(); updateHash(); }
        });
      });
    }, 0);
    if (openCard) renderStationCard(id);
  }

  function nearbyPlaces(id, limit) {
    return NET.placeOrder.map(function (pid) { return NET.places[pid]; })
      .filter(function (p) { return p.nearest.some(function (n) { return n.station === id && n.distanceM <= 1500; }); })
      .map(function (p) { return { p: p, d: p.nearest.filter(function (n) { return n.station === id; })[0].distanceM }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, limit || 6);
  }

  function renderStationCard(id) {
    var s = NET.stations[id];
    var flags = [];
    if (s.interchange) flags.push('<span class="chip x">⇄ ' + t('st.interchange') + '</span>');
    if (s.busHub) flags.push('<span class="chip">🚌 ' + t('st.bus') + '</span>');
    if (s.parkAndRide) flags.push('<span class="chip">🅿️ ' + t('st.pr') + '</span>');
    var rows = s.lines.map(function (lid) {
      var line = NET.lines[lid];
      var i = line.stations.indexOf(id);
      var prev = i > 0 ? line.stations[i - 1] : null, next = i < line.stations.length - 1 ? line.stations[i + 1] : null;
      var str = s.structure[lid] ? t('struct.' + s.structure[lid]) : '';
      return '<div style="margin-top:10px">' + badge(line) + (str ? ' <span class="chip">' + esc(str) + '</span>' : '') +
        '<div class="neigh">' +
        (prev ? '<a href="#" data-st="' + prev + '">◀ ' + esc(name(prev)) + '<span>' + t('st.prev') + '</span></a>' : '<a><i>' + t('st.terminus') + '</i><span>' + t('st.prev') + '</span></a>') +
        (next ? '<a href="#" data-st="' + next + '">' + esc(name(next)) + ' ▶<span>' + t('st.next') + '</span></a>' : '<a><i>' + t('st.terminus') + '</i><span>' + t('st.next') + '</span></a>') +
        '</div></div>';
    }).join('');
    var aka = s.aliases ? (s.aliases[NL()] || []).concat(s.aliases[OL()] || []).slice(0, 4) : [];
    var near = nearbyPlaces(id, 6);
    var coords = s.lat.toFixed(6) + ', ' + s.lng.toFixed(6);
    $('#station-card').innerHTML = '<div class="card station-card">' +
      '<div class="name">' + esc(s.name[NL()]) + '<small>' + esc(altName(id)) + '</small></div>' +
      '<div class="meta">' + flags.join(' ') + '</div>' +
      (aka.length ? '<div class="meta">' + t('st.aka') + ': ' + aka.map(esc).join(' · ') + '</div>' : '') + rows +
      (near.length ? '<div class="meta" style="margin-top:12px"><b>' + t('st.nearby') + '</b></div><div class="chips">' + near.map(function (x) {
        return '<button class="chip-btn" data-place="' + x.p.id + '">' + catIcon(x.p) + ' ' + esc(x.p.name[NL()]) + ' <small>' + fmtDist(x.d) + '</small></button>';
      }).join('') + '</div>' : '') +
      '<div class="meta" style="margin-top:10px">📍 <span class="coord">' + coords + '</span> <button class="btn small ghost" id="btn-copy-coord">' + t('st.copy') + '</button></div>' +
      '<div class="btn-row">' +
      '<button class="btn" data-act="from">🟢 ' + t('st.fromHere') + '</button>' +
      '<button class="btn" data-act="to">🔴 ' + t('st.toHere') + '</button></div>' +
      '<div class="btn-row">' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleMapsPlace(s.lat, s.lng) + '">📌 ' + t('st.gmaps') + '</a>' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleMapsDirections({ destination: [s.lat, s.lng], travelmode: 'walking' }) + '">🚶 ' + t('st.dir') + '</a>' +
      '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleEarth(s.lat, s.lng) + '">🌍 ' + t('st.earth') + '</a>' +
      '<a class="btn small" href="' + RMLinks.geoUri(s.lat, s.lng, s.name[NL()]) + '">📱 ' + t('st.geo') + '</a>' +
      '<button class="btn small" id="btn-share-st">🔗 ' + t('st.share') + '</button>' +
      '</div></div>';
    $$('#station-card [data-st]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); focusStation(a.dataset.st); }); });
    $$('#station-card [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.act === 'from') setFrom(id, null); else setTo(id, null);
        if (state.from && state.to) plan(); else { drawDiagramMarkers(); updateHash(); }
      });
    });
    $$('#station-card [data-place]').forEach(function (b) {
      b.addEventListener('click', function () { var p = NET.places[b.dataset.place]; if (state.from && state.from !== p.station) { setTo(p.station, p.id); plan(); } else { setTo(p.station, p.id); drawDiagramMarkers(); $('#from').focus(); } });
    });
    $('#btn-copy-coord').addEventListener('click', function () { copy(coords); toast(t('st.copied')); });
    $('#btn-share-st').addEventListener('click', function () { copy(location.href.split('#')[0] + '#' + id + '~~' + state.lang); toast(t('toast.copied')); });
    if (!state.itineraries.length && !state.from && !state.to) history.replaceState(null, '', '#' + id + '~~' + state.lang);
  }

  function focusStation(id) {
    var s = NET.stations[id];
    if (state.view === 'map') map.setView([s.lat, s.lng], Math.max(map.getZoom(), 15), { animate: true });
    else if (SCH.pz) SCH.pz.fitStations([id], 120);
    selectStation(id, true);
    switchTab('plan');
  }

  /* ------------------------------------------------------------ geolocate */
  function locate() {
    var box = $('#nearby');
    if (!navigator.geolocation) { box.innerHTML = '<div class="error">' + t('near.err') + '</div>'; return; }
    box.innerHTML = '<div class="card">⏳ …</div>';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      userLayer.clearLayers();
      L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(userLayer);
      L.circle([lat, lng], { radius: Math.min(pos.coords.accuracy || 50, 500), color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(userLayer);
      var near = RMNetwork.nearestStations(NET, lat, lng, 3);
      var walkKmh = (CFG.travelModel && CFG.travelModel.walkingKmh) || 4.5;
      var far = near[0].distanceM > 3000;
      box.innerHTML = '<div class="card"><h3>📍 ' + (far ? t('near.far', { d: fmtDist(near[0].distanceM) }) : t('near.title')) + '</h3>' +
        near.map(function (n) {
          var s = n.station;
          var mins = Math.round(n.distanceM / (walkKmh * 1000 / 60));
          return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">' +
            s.lines.map(function (l) { return badge(NET.lines[l], true); }).join('') +
            '<b>' + esc(s.name[NL()]) + '</b><span style="color:var(--muted);font-size:12px">' + fmtDist(n.distanceM) + ' · ' + mins + ' ' + t('min') + ' ' + t('near.walk') + '</span>' +
            '<span style="margin-inline-start:auto;display:flex;gap:4px">' +
            '<button class="btn small" data-use="' + s.id + '">' + t('near.use') + '</button>' +
            '<a class="btn small" target="_blank" rel="noopener" href="' + RMLinks.googleMapsDirections({ origin: [lat, lng], destination: [s.lat, s.lng], travelmode: 'walking' }) + '">🚶</a></span></div>';
        }).join('') + '</div>';
      $$('#nearby [data-use]').forEach(function (b) { b.addEventListener('click', function () { setFrom(b.dataset.use, null); $('#to').focus(); if (state.to) plan(); else drawDiagramMarkers(); }); });
      if (state.view === 'map') map.fitBounds(L.latLngBounds([[lat, lng], [near[0].station.lat, near[0].station.lng]]), { padding: [60, 60], maxZoom: 15 });
    }, function () { box.innerHTML = '<div class="error">' + t('near.err') + '</div>'; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  /* ------------------------------------------------------------ lines tab */
  function renderLines() {
    $('#lines-list').innerHTML = NET.lineOrder.map(function (lid) {
      var line = NET.lines[lid];
      return '<div class="line-item" data-line="' + lid + '" style="--c:' + line.color + '">' +
        '<header><input type="checkbox" ' + (state.hidden[lid] ? '' : 'checked') + '>' +
        '<div class="t"><b>' + line.number + ' — ' + esc(line.name[NL()]) + ' <small style="display:inline;color:var(--muted);font-weight:400">' + esc(line.name[OL()]) + '</small></b>' +
        '<small>' + esc(name(line.termini.first)) + ' ⇄ ' + esc(name(line.termini.last)) + ' · ' + line.stations.length + ' ' + t('line.stations') + ' · ' + line.officialLengthKm + ' ' + t('line.km') + '</small></div>' +
        '<span style="color:var(--muted)">▾</span></header><ol>' +
        line.stations.map(function (id, i) {
          var s = NET.stations[id];
          var others = s.lines.filter(function (l) { return l !== lid; });
          return '<li data-st="' + id + '"><span class="n' + (s.interchange ? ' x' : '') + '">' + (i + 1) + '</span><span>' + esc(s.name[NL()]) +
            (others.length ? ' <span class="xs">⇄ ' + others.map(function (l) { return NET.lines[l].colorName[NL()]; }).join('، ') + '</span>' : '') +
            '</span><span class="en">' + esc(altName(id)) + '</span></li>';
        }).join('') + '</ol></div>';
    }).join('');
    $$('.line-item header').forEach(function (h) {
      h.addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        var item = h.parentElement;
        var open = !item.classList.contains('open');
        $$('.line-item').forEach(function (el) { el.classList.remove('open'); });
        item.classList.toggle('open', open);
        if (open) showLineOnMap(item.dataset.line, false);
      });
      h.querySelector('input').addEventListener('change', function (e) { setLineVisible(h.parentElement.dataset.line, e.target.checked); });
    });
    $$('.line-item li').forEach(function (li) { li.addEventListener('click', function () { focusStation(li.dataset.st); }); });
  }

  /* ------------------------------------------------------------- info tab */
  function renderInfo() {
    var svc = CFG.service || {}, fares = CFG.fares || {};
    var L2 = state.lang === 'ar' ? 'ar' : 'en';
    var html = '<div class="section-title">' + t('info.hours') + '</div><table class="tbl">' +
      (svc.hours || []).map(function (r) { return '<tr><td>' + esc(hoursLabel(r)) + '</td><td class="num">' + r.open + ' – ' + RMService.formatHM(RMService.parseHM(r.close)) + '</td></tr>'; }).join('') +
      '</table>' + (svc.note ? '<p class="hint">' + esc(svc.note[L2]) + '</p>' : '');
    html += '<div class="section-title">' + t('info.fares') + '</div><table class="tbl"><tr><th>' + t('info.ticket') + '</th><th class="num">' + t('info.standard') + '</th><th class="num">' + t('info.first') + '</th></tr>' +
      (fares.tickets || []).map(function (tk) { return '<tr><td>' + esc(tk.name[L2]) + '</td><td class="num">' + tk.price + ' ' + t('res.sar') + '</td><td class="num">' + (tk.firstClass ? tk.firstClass + ' ' + t('res.sar') : '—') + '</td></tr>'; }).join('') +
      '</table>' + (fares.note ? '<p class="hint">' + esc(fares.note[L2]) + '</p>' : '');
    html += '<div class="section-title">' + t('info.tips') + '</div><ul class="tips">' + (TIPS[state.lang] || TIPS.en).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    // destinations grouped by category
    var groups = {};
    NET.placeOrder.forEach(function (pid) { var p = NET.places[pid]; (groups[p.category] = groups[p.category] || []).push(p); });
    html += '<div class="section-title">' + t('info.destinations') + '</div>';
    Object.keys(groups).forEach(function (cat) {
      var c = NET.placeCategories[cat] || {};
      html += '<div class="dest-group"><div class="dest-cat">' + (c.icon || '📍') + ' ' + esc(c[NL()] || cat) + '</div><div class="chips">' +
        groups[cat].map(function (p) {
          var st = NET.stations[p.station];
          return '<button class="chip-btn" data-place="' + p.id + '" title="' + esc(st.name[NL()] + ' · ' + fmtDist(p.nearest[0].distanceM)) + '">' + esc(p.name[NL()]) +
            ' <small>' + st.lines.map(function (l) { return badge(NET.lines[l], true); }).join('') + ' ' + esc(st.name[NL()]) + ' · ' + fmtDist(p.nearest[0].distanceM) + '</small></button>';
        }).join('') + '</div></div>';
    });
    html += '<div class="section-title">' + t('info.about') + '</div><p class="hint">' + esc(t('info.aboutText')) + '</p><p class="hint">' + esc(t('info.credits')) + '</p>' +
      '<p class="hint">' + t('info.support') + ': <a href="tel:' + esc((CFG.project && CFG.project.supportPhone) || '') + '">' + esc((CFG.project && CFG.project.supportPhone) || '') + '</a> · ' +
      '<a href="' + esc((CFG.project && CFG.project.repoUrl) || '#') + '" target="_blank" rel="noopener">GitHub</a></p>';
    $('#info-content').innerHTML = html;
    $$('#info-content [data-place]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = NET.places[b.dataset.place];
        setTo(p.station, p.id);
        switchTab('plan');
        if (state.from && state.from !== p.station) plan(); else { drawDiagramMarkers(); $('#from').focus(); }
      });
    });
  }

  /* ----------------------------------------------------------- export tab */
  function renderExport() {
    var ar = state.lang === 'ar';
    var dl = function (href, icon, title, sub) { return '<a class="dl" href="' + href + '" download><span class="ic">' + icon + '</span><div><b>' + title + '</b><small>' + sub + '</small></div></a>'; };
    var lines = NET.lineOrder.map(function (lid) { var l = NET.lines[lid]; return '<a class="btn small" style="border-color:' + l.color + '" href="../dist/lines/line-' + l.number + '-' + l.colorName.en.toLowerCase() + '.kml" download>' + l.number + ' ' + esc(l.name[NL()]) + '</a>'; }).join(' ');
    $('#export-content').innerHTML = ar ? (
      '<div class="section-title">🌍 Google Earth</div>' +
      dl('../dist/riyadh-metro.kmz', '🌍', 'riyadh-metro.kmz', 'الشبكة كاملة: 6 مسارات، 83 محطة، محطات التبادل، الوجهات القريبة، وجولات طيران افتراضية — مجهّز بأيقونات مضمّنة') +
      '<ol class="steps"><li><b>Google Earth Pro (سطح المكتب):</b> ملف ← فتح ← اختر ملف KMZ. ستظهر الشبكة في «الأماكن المؤقتة»؛ اسحبها إلى «أماكني» لحفظها.</li>' +
      '<li><b>Google Earth على الويب</b> (earth.google.com): القائمة ☰ ← المشاريع ← فتح ← استيراد ملف KML من الجهاز.</li>' +
      '<li><b>الجوال (Android/iOS):</b> افتح ملف KMZ من المشاركة/الملفات واختر Google Earth. أو ارفعه إلى Google Drive وافتحه من المشاريع.</li>' +
      '<li>انقر على أي محطة لعرض المسارات والمحطة السابقة/التالية وروابط خرائط Google. المجلد «جولات» يشغّل رحلة فوق كل مسار، ومجلد «أماكن ووجهات» (مخفي افتراضياً) يعرض الوجهات الشهيرة وأقرب محطة لها.</li></ol>' +
      '<div class="section-title">🗺️ خرائط Google (My Maps)</div>' +
      dl('../dist/riyadh-metro.kml', '🗺️', 'riyadh-metro.kml', 'نسخة KML للاستيراد في Google My Maps (تظهر بعدها داخل تطبيق خرائط Google ضمن «المحفوظة ← الخرائط»)') +
      '<div class="btn-row" style="margin:0 0 8px">' + lines + '</div>' +
      '<ol class="steps"><li>افتح <a href="https://www.google.com/maps/d/" target="_blank" rel="noopener">google.com/maps/d</a> ← إنشاء خريطة جديدة.</li>' +
      '<li>استيراد ← اختر <code>riyadh-metro.kml</code> (أو ملف كل مسار كطبقة مستقلة للتحكم بالألوان).</li>' +
      '<li>في تطبيق خرائط Google على الجوال: المحفوظة ← الخرائط ← اختر الخريطة لتظهر المسارات فوق الخريطة أثناء التنقل.</li></ol>' +
      dl('../dist/riyadh-metro-stations.csv', '📊', 'riyadh-metro-stations.csv', 'جدول المحطات (عربي/إنجليزي، الإحداثيات، المسارات، روابط خرائط Google) — يُستورد أيضاً في My Maps وExcel') +
      dl('../dist/riyadh-metro-places.csv', '📍', 'riyadh-metro-places.csv', 'الوجهات الشهيرة (مولات، مستشفيات، معالم…) مع أقرب محطة ومسافة المشي — طبقة إضافية في My Maps') +
      '<div class="section-title">🚇 مخطط الشبكة</div>' +
      dl('../dist/riyadh-metro-diagram.svg', '🚇', 'riyadh-metro-diagram.svg', 'المخطط التخطيطي للشبكة بصيغة SVG (عربي) — للطباعة أو التضمين، وبالإنجليزية: riyadh-metro-diagram-en.svg') +
      '<div class="section-title">🧩 للمطوّرين</div>' +
      dl('../dist/riyadh-metro.geojson', '{ }', 'riyadh-metro.geojson', 'المسارات + المحطات بصيغة GeoJSON مع ألوان simplestyle — Google Maps Data Layer، Leaflet، MapLibre، QGIS') +
      dl('../dist/riyadh-metro-places.geojson', '{ }', 'riyadh-metro-places.geojson', 'الوجهات مع أقرب محطة ومسافة المشي بصيغة GeoJSON') +
      dl('../dist/riyadh-metro-network.json', '🕸️', 'riyadh-metro-network.json', 'الشبكة القابلة للتوجيه: المقاطع بين المحطات، المسافات، الأزمنة التقديرية، زمن التبديل') +
      dl('../dist/riyadh-metro.gpx', '🛰️', 'riyadh-metro.gpx', 'نقاط المحطات + مسارات الخطوط لأجهزة GPS وOsmAnd وGarmin') +
      '<p class="hint">صفحة <a href="google-maps.html">google-maps.html</a> تعرض الشبكة ومخطط الرحلات مباشرة على Google Maps JavaScript API (تحتاج مفتاح API خاص بك).</p>' +
      '<p class="hint">مشروع مجتمعي غير رسمي. الإحداثيات ومسارات الخطوط من بيانات المسارات المفتوحة لمشغّل النقل العام بالرياض. الأزمنة تقديرية.</p>'
    ) : (
      '<div class="section-title">🌍 Google Earth</div>' +
      dl('../dist/riyadh-metro.kmz', '🌍', 'riyadh-metro.kmz', 'Whole network: 6 lines, 83 stations, interchanges, nearby destinations and fly-over tours — with embedded icons') +
      '<ol class="steps"><li><b>Google Earth Pro (desktop):</b> File → Open → pick the KMZ. It appears under “Temporary Places”; drag it to “My Places” to keep it.</li>' +
      '<li><b>Google Earth on the web</b> (earth.google.com): ☰ → Projects → Open → Import KML file from computer.</li>' +
      '<li><b>Mobile (Android/iOS):</b> open the KMZ from Files/Share and choose Google Earth, or upload it to Google Drive and open it from Projects.</li>' +
      '<li>Click any station for its lines, previous/next stations and Google Maps links. The “Tours” folder plays a fly-over of each line; the “Destinations” folder (hidden by default) lists popular places with their nearest station.</li></ol>' +
      '<div class="section-title">🗺️ Google Maps (My Maps)</div>' +
      dl('../dist/riyadh-metro.kml', '🗺️', 'riyadh-metro.kml', 'Plain KML for Google My Maps import (then visible inside the Google Maps app under Saved → Maps)') +
      '<div class="btn-row" style="margin:0 0 8px">' + lines + '</div>' +
      '<ol class="steps"><li>Open <a href="https://www.google.com/maps/d/" target="_blank" rel="noopener">google.com/maps/d</a> → Create a new map.</li>' +
      '<li>Import → choose <code>riyadh-metro.kml</code> (or one file per line as separate layers to control colours).</li>' +
      '<li>In the Google Maps mobile app: Saved → Maps → pick the map to overlay the lines while navigating.</li></ol>' +
      dl('../dist/riyadh-metro-stations.csv', '📊', 'riyadh-metro-stations.csv', 'Station table (Arabic/English names, coordinates, lines, Google Maps links) — also imports into My Maps and Excel') +
      dl('../dist/riyadh-metro-places.csv', '📍', 'riyadh-metro-places.csv', 'Popular destinations (malls, hospitals, landmarks…) with nearest station and walking distance — an extra My Maps layer') +
      '<div class="section-title">🚇 Network diagram</div>' +
      dl('../dist/riyadh-metro-diagram-en.svg', '🚇', 'riyadh-metro-diagram-en.svg', 'Schematic network diagram as SVG (English) — print or embed it; Arabic: riyadh-metro-diagram.svg') +
      '<div class="section-title">🧩 For developers</div>' +
      dl('../dist/riyadh-metro.geojson', '{ }', 'riyadh-metro.geojson', 'Lines + stations as GeoJSON with simplestyle colours — Google Maps Data Layer, Leaflet, MapLibre, QGIS') +
      dl('../dist/riyadh-metro-places.geojson', '{ }', 'riyadh-metro-places.geojson', 'Destinations with nearest station and walking distance as GeoJSON') +
      dl('../dist/riyadh-metro-network.json', '🕸️', 'riyadh-metro-network.json', 'Routable network: inter-station segments, distances, estimated run times, transfer penalties') +
      dl('../dist/riyadh-metro.gpx', '🛰️', 'riyadh-metro.gpx', 'Station waypoints + line tracks for GPS devices, OsmAnd, Garmin') +
      '<p class="hint"><a href="google-maps.html">google-maps.html</a> renders the network and the planner directly on the Google Maps JavaScript API (needs your own API key).</p>' +
      '<p class="hint">Unofficial community project. Coordinates and alignments come from the Riyadh public-transport operator’s open route data. Times are estimates.</p>'
    );
  }

  /* --------------------------------------------------------------- legend */
  function renderLegend() {
    $('#legend').innerHTML = NET.lineOrder.map(function (lid) {
      var l = NET.lines[lid];
      return '<div><i style="background:' + l.color + '"></i>' + l.number + ' ' + esc(l.name[NL()]) + '</div>';
    }).join('') + '<div><span class="x"></span>' + t('legend.x') + '</div>';
  }

  /* ------------------------------------------------- service status / time */
  function renderStatus() {
    var chip = $('#status-chip');
    if (!CFG.service) { chip.style.display = 'none'; return; }
    var now = RMService.riyadhNow();
    var st = RMService.status(CFG, now);
    chip.classList.toggle('open', st.open); chip.classList.toggle('closed', !st.open);
    chip.textContent = st.open ? t('status.open', { t: st.closesAt }) : (st.opensDow === now.dow ? t('status.closed', { t: st.opensAt }) : t('status.closedDay', { d: dow(st.opensDow), t: st.opensAt }));
    chip.title = hoursSummary();
  }
  function renderDepartOptions() {
    var sel = $('#depart');
    var current = sel.value || state.depart || 'now';
    var opts = RMService.departureOptions(RMService.riyadhNow());
    sel.innerHTML = opts.map(function (o) { return '<option value="' + o.value + '">' + (o.value === 'now' ? t('plan.now') : o.label) + '</option>'; }).join('');
    sel.value = opts.some(function (o) { return o.value === current; }) ? current : 'now';
    state.depart = sel.value;
  }

  /* ------------------------------------------------------------- helpers */
  function switchTab(id) {
    $$('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === id); });
    $$('.tab').forEach(function (s) { s.classList.toggle('active', s.id === 'tab-' + id); });
  }
  function collapsePanel(collapsed) {
    $('#panel').classList.toggle('collapsed', collapsed);
    setTimeout(function () { map.invalidateSize(); if (state.view === 'diagram' && SCH.pz && !state.itineraries.length) SCH.pz.fit(true); }, 280);
  }
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function refToken(st, pl) { return pl ? 'p:' + pl : (st || ''); }
  function hashString() {
    var h = refToken(state.from, state.fromPlace) + '~' + refToken(state.to, state.toPlace) + '~' + state.lang;
    if (state.from && state.to && state.mode !== 'fastest') h += '~' + state.mode;
    return h;
  }
  function shareUrl() { return location.href.split('#')[0] + '#' + hashString(); }
  function updateHash() { history.replaceState(null, '', '#' + hashString()); }
  function readHash() {
    var raw = location.hash.replace(/^#/, '');
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    if (!raw) return {};
    if (raw.indexOf('=') >= 0) {                                   // legacy: from=…&to=…&mode=…&lang=…  /  station=…
      var out = {};
      raw.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) out[p[0]] = p[1] || ''; });
      if (out.station) { out.from = out.station; out.to = ''; }
      return out;
    }
    var p = raw.split('~');
    return { from: p[0] || '', to: p[1] || '', lang: p[2] || '', mode: p[3] || '' };
  }
  /** Resolve a hash token to { station, place }: station id, "p:<place>", or a fuzzy name/alias (e.g. "batha", "hamra"). */
  function resolveRef(tok) {
    if (!tok) return null;
    if (tok.indexOf('p:') === 0 || tok.indexOf('p_') === 0) { var pl = NET.places[tok.slice(2)]; return pl ? { station: pl.station, place: pl.id } : null; }
    if (NET.stations[tok]) return { station: tok, place: null };
    var r = RMNetwork.searchAll(NET, tok.replace(/[-_]+/g, ' '), 1);
    return r.length && r[0].score >= 54 ? pickToRef(r[0]) : null;
  }

  function applyLang() {
    var prevNames = SCH.lang;
    document.documentElement.lang = state.lang;
    document.documentElement.dir = LANGS[state.lang].dir;
    document.title = t('app.title') + ' | ' + (state.lang === 'ar' ? 'Riyadh Metro Navigator' : 'مترو الرياض');
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-title]').forEach(function (el) { el.title = t(el.dataset.i18nTitle); });
    $('#lang-select').value = state.lang;
    $('#panel-toggle').dataset.label = t('panel.open');
    fillInput($('#from'), state.from, state.fromPlace); fillInput($('#to'), state.to, state.toPlace);
    renderLines(); renderExport(); renderInfo(); renderLegend(); renderPopular(); renderStatus(); renderDepartOptions(); updateLabels();
    if (SCH.svgEl && prevNames !== NL()) buildDiagram(true);
    if (state.itineraries.length) renderItinerary();
    if (state.station) renderStationCard(state.station);
    refreshSchHint();
    localStorage.setItem('rm.lang', state.lang);
  }

  /* ---------------------------------------------------------------- wire */
  function init() {
    var h = readHash();
    if (h.lang && LANGS[h.lang]) state.lang = h.lang;
    else if (!storedLang) {
      var nav = (navigator.language || 'ar').slice(0, 2).toLowerCase();
      if (nav === 'tl') nav = 'fil';
      if (LANGS[nav]) state.lang = nav;
    }
    var sel = $('#lang-select');
    sel.innerHTML = Object.keys(LANGS).map(function (k) { return '<option value="' + k + '">' + LANGS[k].label + '</option>'; }).join('');
    sel.addEventListener('change', function () { state.lang = sel.value; applyLang(); updateHash(); });

    drawNetwork();
    applyLang();
    setView(state.view === 'map' ? 'map' : 'diagram', true);

    setupSuggest($('#from'), $('#from-suggest'), function (r) { var ref = pickToRef(r); setFrom(ref.station, ref.place); if (state.to) plan(); else { $('#to').focus(); drawDiagramMarkers(); updateHash(); } });
    setupSuggest($('#to'), $('#to-suggest'), function (r) { var ref = pickToRef(r); setTo(ref.station, ref.place); if (state.from) plan(); else { drawDiagramMarkers(); updateHash(); } });
    $('#btn-plan').addEventListener('click', function () { plan(); });
    $('#btn-swap').addEventListener('click', function () {
      var f = state.from, fp = state.fromPlace, tt = state.to, tp = state.toPlace;
      setFrom(tt, tp); setTo(f, fp);
      if (state.from && state.to) plan(); else { drawDiagramMarkers(); updateHash(); }
    });
    $('#btn-clear-to').addEventListener('click', function () { setTo(null, null); clearRoute(); $('#to').focus(); });
    $('#btn-locate').addEventListener('click', locate);
    $('#btn-clear').addEventListener('click', function () { setFrom(null, null); setTo(null, null); $('#station-card').innerHTML = ''; state.station = null; clearRoute(); hideSchHint(); });
    $('#btn-fit').addEventListener('click', fitNetwork);
    $('#btn-basemap').addEventListener('click', function () {
      map.removeLayer(baseLayers[baseOrder[baseIdx]]);
      baseIdx = (baseIdx + 1) % baseOrder.length;
      baseLayers[baseOrder[baseIdx]].addTo(map).bringToBack();
      toast(t('base.' + baseOrder[baseIdx]));
    });
    $$('.view-switch button').forEach(function (b) { b.addEventListener('click', function () {
      if (b.dataset.view === 'gmaps') { location.href = 'google-maps.html#' + hashString(); return; }
      setView(b.dataset.view);
    }); });
    $('#sch-zoom-in').addEventListener('click', function () { var vp = $('#sch-viewport'); SCH.pz.zoomAt(1.4, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    $('#sch-zoom-out').addEventListener('click', function () { var vp = $('#sch-viewport'); SCH.pz.zoomAt(1 / 1.4, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { switchTab(b.dataset.tab); }); });
    $('#panel-toggle').addEventListener('click', function () { collapsePanel(!$('#panel').classList.contains('collapsed')); });
    $$('input[name=mode]').forEach(function (r) { r.addEventListener('change', function () { if (state.from && state.to) plan(); }); });
    $('#depart').addEventListener('change', function () { state.depart = $('#depart').value; if (state.itineraries.length) renderItinerary(); });
    $('#status-chip').addEventListener('click', function () { switchTab('info'); collapsePanel(false); });
    map.on('click', function () { if (window.innerWidth <= 860 && !state.itineraries.length) collapsePanel(true); });
    setInterval(function () { renderStatus(); if (!state.itineraries.length) renderDepartOptions(); }, 60000);

    // restore from URL
    var A = resolveRef(h.from), B = resolveRef(h.to);
    if (A) setFrom(A.station, A.place);
    if (B) setTo(B.station, B.place);
    if (h.mode === 'fewest-transfers' || h.mode === 'fewest') { document.querySelector('input[name=mode][value=fewest-transfers]').checked = true; }
    if (state.from && state.to) plan(true);
    else if (state.from && !state.fromPlace) { focusStation(state.from); drawDiagramMarkers(); }
    else if (state.from || state.to) drawDiagramMarkers();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
    }
  }

  init();
})();
