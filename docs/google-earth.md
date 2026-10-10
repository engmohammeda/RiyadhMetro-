# استخدام الشبكة في Google Earth — Using the network in Google Earth

الملف الرئيسي: **[`dist/riyadh-metro.kmz`](../dist/riyadh-metro.kmz)** (44 KB) — يحتوي على:

- 📍 **6 مجلدات محطات** (مجلد لكل مسار، المحطات مرقّمة بالترتيب) + مجلد **محطات التبادل** (10 محطات).
- 🚇 **6 مسارات** بالألوان الرسمية (أزرق، أحمر، برتقالي، أصفر، أخضر، بنفسجي) مرسومة على المسار الهندسي الفعلي.
- 🎬 **6 جولات طيران افتراضية** (`gx:Tour`) — واحدة لكل مسار، تطير فوق المحطات بالترتيب وتفتح بالون كل محطة.
- 🏛️ **مجلد «أماكن ووجهات»** (مخفي افتراضياً — فعّله من مربع الاختيار): ~50 وجهة شهيرة (مولات، مستشفيات، جامعات، معالم، أسواق) مع أقرب محطة ومسافة المشي، ورابط اتجاهات مشي من المحطة.
- 🧾 بالون معلومات لكل محطة: الاسم عربي/إنجليزي، المسارات، المحطة السابقة/التالية على كل مسار، نوع المحطة، الإحداثيات، وروابط «خرائط Google» و«الاتجاهات» و«Google Earth web».
- أيقونات مضمّنة داخل KMZ (تعمل دون إنترنت).

> نسخة KML غير مضغوطة بأيقونات مستضافة: [`dist/riyadh-metro.kml`](../dist/riyadh-metro.kml) — مناسبة لـ Google My Maps والأدوات التي لا تقبل KMZ.

## Google Earth Pro (سطح المكتب — Windows / macOS / Linux)

1. **File → Open** (أو اسحب الملف إلى النافذة) ← اختر `riyadh-metro.kmz`.
2. ستظهر «مترو الرياض • Riyadh Metro» في **Temporary Places**. اسحبها إلى **My Places** ثم **File → Save → Save My Places** لتبقى دائماً.
3. من اللوحة اليسرى: فعّل/عطّل أي مسار أو مجلد محطات.
4. لتشغيل جولة: افتح مجلد **🎬 جولات • Tours** وانقر نقراً مزدوجاً على جولة أي مسار.
5. انقر على أي محطة لفتح بالون المعلومات والروابط.

## Google Earth على الويب (earth.google.com)

1. افتح [earth.google.com](https://earth.google.com/web/).
2. القائمة **☰ → Projects (المشاريع) → Open → Import KML file from computer** ← اختر `riyadh-metro.kmz`.
3. يُحفظ المشروع في Google Drive تلقائياً ويمكن مشاركته برابط.

## Google Earth على الجوال (Android / iOS)

- **Android:** افتح `riyadh-metro.kmz` من تطبيق الملفات أو من رسالة واتساب/بريد ← «فتح باستخدام» ← Google Earth.
- **iOS:** احفظ الملف في «الملفات» ← اضغط عليه ← مشاركة ← Google Earth. أو ارفعه إلى Google Drive وافتحه من **المشاريع → فتح من Drive** داخل تطبيق Earth.

## روابط مباشرة إلى المحطات

كل محطة لها رابط Google Earth web مُولَّد من إحداثياتها، مثل المركز المالي:

```
https://earth.google.com/web/@24.767874,46.643009,620a,1400d,35y,0h,50t,0r
```

الصيغة: `@lat,lng,ALTa,DISTd,FOVy,HEADINGh,TILTt,ROLLr` — الروابط موجودة في بالونات KML، وفي جدول `dist/riyadh-metro-stations.csv` (عمود `google_earth`)، وفي التطبيق التفاعلي.

## تصدير رحلة إلى Google Earth

من التطبيق التفاعلي (`web/`) خطّط رحلة ثم اضغط **«تنزيل KML للرحلة»** — تحصل على ملف يحوي:
مقاطع الرحلة بلون كل مسار، نقطة البداية (خضراء)، الوصول (حمراء)، محطات التبديل، وخطوات الرحلة نصاً داخل بالون الملف. افتحه بنفس الطرق أعلاه.

## ملفات لكل مسار على حدة

`dist/lines/line-1-blue.kml` … `line-6-purple.kml` — كل ملف يحوي مسار واحد مع محطاته وجولته؛ مفيد عندما تريد تحميل مسار واحد فقط أو جعل كل مسار طبقة مستقلة.

---

## English quick reference

| Platform | Steps |
|---|---|
| Google Earth Pro | File → Open → `dist/riyadh-metro.kmz`; drag from *Temporary Places* to *My Places*; double-click a tour in the **Tours** folder |
| earth.google.com | ☰ → Projects → Open → *Import KML file from computer* |
| Android / iOS | Open the KMZ from Files/Share → Google Earth, or upload to Drive and open from *Projects* |
| Per-line files | `dist/lines/line-N-<colour>.kml` |
| Journey export | Web app → plan a trip → *Download route KML* |
