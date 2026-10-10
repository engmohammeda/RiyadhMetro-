# الدمج مع خرائط Google — Google Maps integration

هناك ثلاث طرق متكاملة، من الأسهل إلى الأكثر تخصيصاً:

## 1) Google My Maps — لتظهر الشبكة داخل تطبيق خرائط Google (بدون برمجة)

1. افتح [google.com/maps/d](https://www.google.com/maps/d/) ← **إنشاء خريطة جديدة**.
2. في الطبقة الأولى اضغط **استيراد** ← اختر [`dist/riyadh-metro.kml`](../dist/riyadh-metro.kml)
   (أو استورد ملفات المسارات الستة `dist/lines/*.kml` كل واحد في **طبقة مستقلة** لتتحكم بإظهار كل مسار على حدة).
3. سمِّ الخريطة «مترو الرياض» واحفظها.
4. على الجوال: افتح **تطبيق خرائط Google → المحفوظة → الخرائط → مترو الرياض** ← تظهر المسارات والمحطات فوق الخريطة أثناء التنقل، وتبقى ظاهرة أثناء البحث عن الاتجاهات.
5. يمكنك مشاركة الخريطة برابط عام أو تضمينها في موقع.

ملاحظات:
- My Maps يحتفظ بالأسماء والأوصاف (العربية/الإنجليزية، المسارات، المحطة السابقة/التالية، الروابط) ويحوّل الأيقونات إلى أيقوناته الافتراضية؛ لون الخطوط يُحفظ.
- بدلاً من KML يمكن استيراد [`dist/riyadh-metro-stations.csv`](../dist/riyadh-metro-stations.csv): My Maps يتعرّف على عمودي `latitude`/`longitude` تلقائياً، واختر `name_ar` أو `name_en` كعنوان.
- طبقة إضافية للوجهات: [`dist/riyadh-metro-places.csv`](../dist/riyadh-metro-places.csv) (أو `-places.geojson`) — كل مكان مع `nearest_station_*` و`walk_m`/`walk_min`، مفيد لتلوين الأماكن حسب الفئة أو المحطة.
- الحد الأقصى: 10 طبقات و2,000 عنصر لكل طبقة — شبكتنا 89 عنصراً فقط.

## 2) روابط عميقة (تعمل على الويب وتطبيقات Android/iOS)

| الغرض | الصيغة | مثال (المركز المالي) |
|---|---|---|
| دبوس على المحطة | `https://www.google.com/maps/search/?api=1&query=LAT,LNG` | [فتح](https://www.google.com/maps/search/?api=1&query=24.767874%2C46.643009) |
| اتجاهات المشي إلى المحطة من موقعك | `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=walking` | [فتح](https://www.google.com/maps/dir/?api=1&destination=24.767874%2C46.643009&travelmode=walking) |
| رحلة مواصلات عامة بين محطتين | `https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&travelmode=transit&transit_mode=subway` | [المركز المالي ← المتحف الوطني](https://www.google.com/maps/dir/?api=1&origin=24.767874%2C46.643009&destination=24.645274%2C46.713158&travelmode=transit&transit_mode=subway) |
| فتح تطبيق الخرائط الافتراضي (جوال) | `geo:LAT,LNG?q=LAT,LNG(الاسم)` | `geo:24.767874,46.643009?q=24.767874,46.643009(KAFD)` |

خرائط Google تعرض مترو الرياض ضمن اتجاهات المواصلات العامة، لذا زر **«افتح في خرائط Google (مواصلات)»** في التطبيق التفاعلي يفتح نفس الرحلة مع المواعيد الفعلية — بينما يعطيك مخطط المشروع التفاصيل الكاملة للتبديل والاتجاهات داخل الشبكة.

الروابط لكل محطة جاهزة في: `dist/riyadh-metro-stations.csv` (أعمدة `google_maps`, `google_earth`)، وفي خصائص GeoJSON، وفي بالونات KML.

## 3) Google Maps JavaScript API — دمج برمجي كامل واحترافي

صفحة [`web/google-maps.html`](../web/google-maps.html) تدمج الشبكة ومخطط الرحلات **كجزء أصيل من خريطة جوجل** — ليس مجرد خطوط فوقها:

```
web/google-maps.html?key=YOUR_GOOGLE_MAPS_API_KEY
web/google-maps.html?key=YOUR_KEY#kafd~airport-t1-2~ar      ← رحلة جاهزة برابط قصير
```

**الشبكة:**
- كل مسار: غلاف أبيض + لون رسمي فوق المحاذاة الهندسية الحقيقية، بترتيب z-index صحيح.
- محطات `AdvancedMarkerElement` بمحتوى SVG: حلقة سوداء لمحطات التبادل، تكبير عند التحويم، وأسماء تظهر تدريجياً حسب مستوى التكبير (التبادل أولاً).
- **النقر على أي خط يُبرزه**: تُخفت بقية الشبكة، تُقرَّب حدود الخط، وتظهر بطاقته (المحطات بالترتيب، الطول، الافتتاح، المحور) — والنقر على محطة يفتح بطاقتها الكاملة (المسارات، السابقة/التالية، الروابط، «من هنا/إلى هنا»).
- وسيلة إيضاح تفاعلية لإظهار/إخفاء كل مسار + طبقة اختيارية للوجهات (~50 مكاناً مع أقرب محطة)، وتبديل خلفية (خريطة/قمر صناعي/هجين).

**الرحلة:**
- نفس محرك التوجيه (`src/router.js`): بحث فوري بالمحطات والأماكن والأسماء القديمة، وضع «الأسرع/أقل تبديل»، وقت المغادرة، الأجرة، والتحذيرات بتوقيت الرياض.
- تُرسم الرحلة **بأسهم اتجاه متحركة** على طول كل ساق، غلاف أبيض سميك، أرجل مشي متقطعة للأماكن، دبابيس A/B، وشارات تبديل مرقّمة — مع تعتيم بقية الشبكة خلفها وخط زمني مفصّل بالخطوات.
- تصدير الرحلة: رابط مشاركة قصير (نفس صيغة التطبيق الرئيسي)، **تنزيل KML/GeoJSON للرحلة**، وزر «افتح في خرائط Google (مواصلات)».

**تشغيل وأمان:**
- المفتاح يُدخل في الصفحة ويُحفظ محلياً في المتصفح فقط (`localStorage`)، أو يُمرَّر بالرابط `?key=`، مع دعم `?mapid=` لخريطة مخصصة (وإلا `DEMO_MAP_ID`).
- أخطاء المصادقة تُلتقط (`gm_authFailure`) مع رسالة تشخيص: المفتاح، تفعيل «Maps JavaScript API»، وقيود الإحالة (referrer) إن كانت مفعّلة.
- زر **🗂️ طبقة KML** يحمّل `dist/riyadh-metro.kml` عبر `google.maps.KmlLayer` — يتطلب أن يكون الملف على رابط عام (مثل GitHub Pages).
- زر «🌐 Google Maps» في التطبيق الرئيسي (`index.html`) يفتح هذه الصفحة حاملاً الرحلة الحالية بنفس الرابط المختصر.

لاستخدام البيانات في تطبيقك الخاص:

```js
// Data layer: ألوان simplestyle جاهزة في الخصائص
map.data.loadGeoJson('https://<your-host>/dist/riyadh-metro.geojson');
map.data.setStyle(f => f.getGeometry().getType() === 'LineString'
  ? { strokeColor: f.getProperty('stroke'), strokeWeight: 5 }
  : { icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: f.getProperty('marker-color'), fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
```

## 4) تطبيقات أخرى

- **Apple Maps / OsmAnd / Maps.me / Organic Maps / Garmin:** استورد `dist/riyadh-metro.gpx` (نقاط المحطات + مسارات الخطوط).
- **QGIS / ArcGIS / Mapbox / MapLibre / Leaflet:** `dist/riyadh-metro.geojson` أو الملفات المنفصلة `-lines` / `-stations` / `-segments`.
- **Excel / Google Sheets / Power BI:** `dist/riyadh-metro-stations.csv` و`dist/riyadh-metro-line-stops.csv`.

---

## English quick reference

1. **Google My Maps:** google.com/maps/d → Create → Import `dist/riyadh-metro.kml` (or one `dist/lines/*.kml` per layer) → shows up in the Google Maps app under *Saved → Maps*.
2. **Deep links:** `maps/search/?api=1&query=lat,lng` (pin), `maps/dir/?api=1&destination=lat,lng&travelmode=walking` (walk to station), `maps/dir/?api=1&origin=…&destination=…&travelmode=transit&transit_mode=subway` (metro trip), `geo:` URIs for mobile.
3. **Maps JavaScript API:** `web/google-maps.html?key=…` renders lines, stations and the journey planner on Google Maps; `map.data.loadGeoJson('dist/riyadh-metro.geojson')` for your own app; `KmlLayer` with the public KML URL.
4. **Other apps:** GPX for Apple Maps/OsmAnd/Garmin, GeoJSON for QGIS/MapLibre/Leaflet, CSV for Sheets/Excel/Power BI.
