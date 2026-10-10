# مصادر البيانات — Data sources & provenance

| الملف | المحتوى | المصدر |
|---|---|---|
| `stations.json` | 83 محطة فريدة: الأسماء (عربي/إنجليزي)، الإحداثيات WGS84، المسارات، محور حافلات، اركن واركب، معرّف التوقف لدى المشغّل | بيانات المسارات المفتوحة لمشغّل النقل العام بالرياض (الموقع العام لحافلات الرياض / الهيئة الملكية لمدينة الرياض) كما نُشرت في المستودع العام `aqar-app/Riyadh-Metro-Routes-and-Stations` |
| `shapes.json` | المسار الهندسي لكل خط (1,142 نقطة) | نفس المصدر أعلاه (`riyadh_metro.json → metro.line[].coords`) |
| `lines.json` | ترتيب المحطات على كل مسار، نوع المحطة (مرتفعة/نفقية/أرضية)، الألوان، الأطوال الرسمية، تواريخ الافتتاح | الترتيب مُشتق من إسقاط المحطات على المسار الهندسي ومُطابق مع قائمة المحطات العامة؛ نوع المحطة من مجموعة بيانات مجتمعية (`ehsaasradio-bot/riyadh-metro-map`) **للاسترشاد فقط**؛ الأطوال والتواريخ من الإعلانات الرسمية (الأزرق 38 كم، الأحمر 25.3، البرتقالي 40.7، الأصفر 29.6، الأخضر 12.9، البنفسجي 29.9 = 176.4 كم؛ الافتتاح 1 ديسمبر 2024 للأزرق/الأصفر/البنفسجي، 15 ديسمبر 2024 للأحمر/الأخضر، 5 يناير 2025 للبرتقالي) |
| `config.json` | معاملات تقدير الزمن، أزمنة التبديل، معلومات عامة | تقديرات المشروع — ليست بيانات رسمية |

## ملاحظات على الجودة

- جميع المحطات تقع على بُعد أقل من **250 م** من المسار الهندسي لخطّها (المسافة الحقيقية إلى محور السكة؛ المحطات طولها 150–300 م).
- تمت مقارنة الإحداثيات مع مجموعة بيانات مستقلة ثانية: التطابق في الأسماء 83/83، وفرق الموقع الوسيط ≈ 60 م والأقصى ≈ 350 م (نقطة المدخل مقابل منتصف المحطة).
- الأطوال المحسوبة من المسارات الهندسية (171.4 كم) أقل بنحو 3% من الأطوال الرسمية (176.4 كم) لأن المسار الهندسي مبسّط ولا يشمل أطراف الورش/المناولة.
- الإعلانات الرسمية تذكر 85 محطة؛ بيانات المسارات المفتوحة تتضمن 83 محطة فريدة قيد التشغيل (94 توقّفاً على مستوى المسارات). عند توفر محطات جديدة يكفي إضافتها إلى `stations.json` و`lines.json` ثم `npm run build`.
- الأزمنة بين المحطات **تقديرية** (`config.json → travelModel`): سرعة متوسطة 65 كم/س + 50 ثانية توقف لكل محطة + 5 دقائق للتبديل (دقيقتان على الجذع المشترك للأصفر/البنفسجي، 7 دقائق في المركز المالي).

## الترخيص

- كود المشروع: MIT (انظر `LICENSE`).
- بيانات المحطات والمسارات مُشتقة من بيانات عامة متاحة للجمهور من مشغّل النقل العام في الرياض؛ هذا المشروع مجتمعي غير رسمي وغير تابع للهيئة الملكية لمدينة الرياض أو لمشغّلي المترو. يُرجى الإبقاء على نسبة المصدر عند إعادة الاستخدام.

---

## English summary

- **Stations & alignments** come from the Riyadh public-transport operator's open route data (Riyadh Bus / RCRC public site) as mirrored in the public repository `aqar-app/Riyadh-Metro-Routes-and-Stations`.
- **Station order** is derived by projecting stations on the alignment; **structure type** (elevated / underground / at-grade) comes from a community dataset and is indicative only.
- **Official lengths / opening dates** are from public announcements (176.4 km in total; phased openings 1 Dec 2024, 15 Dec 2024, 5 Jan 2025).
- **Run times are estimates** (65 km/h average + 50 s dwell per stop + transfer penalties) — the operator does not publish inter-station timings.
- Code is MIT-licensed; the project is unofficial and not affiliated with RCRC or the metro operators.
