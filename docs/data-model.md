# نموذج البيانات — Data model

كل شيء يُولَّد من ملفات JSON صغيرة في `data/` (المصدر الوحيد للحقيقة). لا تُحرَّر ملفات `dist/` أو `web/data/` أو `web/lib/` يدوياً — شغّل `npm run build`.

> **النقل العام:** ملفات `data/bus/*.json` و`data/districts.json` و`data/park-and-ride.json` **مولَّدة** من النسخ الخام في `data/bus/source/` عبر `npm run import:transit` — لا تُحرَّر يدوياً أيضاً.

## `data/stations.json`

```jsonc
{
  "id": "kafd",                              // slug ثابت يُستخدم في الروابط (#station=kafd)
  "name": { "ar": "المركز المالي", "en": "KAFD" },
  "lat": 24.767874, "lng": 46.643009,        // WGS84
  "lines": ["1", "4", "6"],                  // تُعاد حسابها من lines.json عند البناء
  "busHub": true,                            // محور حافلات (من بيانات المشغّل)
  "parkAndRide": false,                      // مواقف اركن واركب
  "operatorStopId": 80001059                 // معرّف التوقف في بيانات المشغّل
}
```

## `data/lines.json`

```jsonc
{
  "id": "4", "number": 4, "color": "#FFD105",
  "name": { "ar": "المسار الأصفر", "en": "Yellow Line" },
  "colorName": { "ar": "الأصفر", "en": "Yellow" },
  "corridor": { "ar": "طريق مطار الملك خالد الدولي", "en": "King Khalid International Airport Road" },
  "officialLengthKm": 29.6, "openedOn": "2024-12-01",
  "stations": [                              // بالترتيب من الطرف الأول إلى الأخير
    { "station": "kafd", "structure": "elevated" },
    { "station": "ar-rabi", "structure": "elevated" },
    …
  ]
}
```

`structure` ∈ `elevated` | `deep_underground` | `shallow_underground` | `at_grade` (قد يختلف للمحطة نفسها بين مسارين).

## `data/shapes.json`

`{ "shapes": { "1": [[lat, lng], …], … } }` — المسار الهندسي لكل خط. الاتجاه لا يهم: البناء يوجّهه تلقائياً من المحطة الأولى إلى الأخيرة.

## `data/config.json`

- `project.siteUrl` / `repoUrl`: تُستخدم في روابط بالونات KML وروابط المشاركة.
- `travelModel`: `cruiseKmh`, `stopPenaltySec`, `transferMinutes`, `transferOverrides[]`, `walkingKmh`.
- `service.hours`: قواعد ساعات التشغيل (`days` بأرقام أيام الأسبوع 0=الأحد … 6=السبت، `open`/`close` بصيغة HH:MM و`24:00` = منتصف الليل)، و`travelModel.initialWaitMinutes` زمن انتظار القطار المضاف عند «المغادرة الآن». تُستخدم في `src/service.js` لحساب حالة الخدمة ووقت الوصول والتنبيهات.
- `fares.tickets[]`: التذاكر (`price` عادي، `firstClass` الدرجة الأولى، `validMinutes` للتذكرة المحدودة). التطبيق يختار أرخص تذكرة تغطي مدة الرحلة.
- `popularTrips[]`: رحلات شائعة تظهر كأزرار في المخطِّط (`from`/`to` معرّفات محطات، و`label` اختياري).

## `places.json` — الأماكن والوجهات

كل عنصر: `id` (slug)، `name{ar,en}`، `aliases{ar[],en[]}` اختياري، `category` (من `categories`)، `lat`/`lng` (تقريبية — `approx: true`)، و`station` اختياري لتثبيت محطة محددة. عند البناء تُحسب أقرب 3 محطات ومسافة/زمن المشي (`walkingKmh` من `config.json`) وتُدمج في `network.places`، وتُصدَّر إلى `dist/riyadh-metro-places.{geojson,csv}` ومجلد «أماكن ووجهات» في KML.

## `schematic.json` — المخطط التخطيطي

- `unit` حجم خلية الشبكة بالبكسل، `bounds` حدود اللوحة بوحدات الشبكة.
- `stations[id] = [x, y, labelMode, overrides?]`: الموقع على الشبكة واتجاه التسمية (`E`/`W` أفقي، `N`/`S` مائل 45°، `n`/`s` فوق/تحت، `NE`/`NW`/`SE`/`SW` قطري) و`overrides.text{ar,en}` لنص من سطرين (`\n`) أو `dx`/`dy` لإزاحة التسمية.
- `via[line]["a|b"] = [[x,y],…]`: نقاط انعطاف بين محطتين متتاليتين (يجب أن تبقى كل القطع أفقية/رأسية/قطرية — البناء يرفض غير ذلك).
- `districts[]` تسميات الأحياء، و`legend`/`title`/`compass` مواضع العناصر. المحرّك `src/schematic.js` يولّد SVG واحداً يُستخدم في التطبيق (تفاعلي) وفي `dist/`.

## الأسماء البديلة `stations[].aliases`

`aliases{ar[],en[]}` أسماء قديمة/شائعة/راعية (مثل «العليا» لمحطة stc، «الفيصلية» لمكتبة الملك فهد، KKIA للمطار). يبحث فيها `searchStations`/`searchAll` بوزن أقل قليلاً من الاسم الرسمي.

## الشبكة المبنية (`RMNetwork.buildNetwork`) → `dist/riyadh-metro-network.json`

```jsonc
{
  "stations": { "kafd": { …, "lines": ["1","4","6"], "interchange": true, "structure": { "1": "elevated", … } } },
  "lines": {
    "4": {
      "stations": ["kafd", "ar-rabi", …], "termini": { "first": "kafd", "last": "airport-t1-2" },
      "shape": [[lat,lng], …], "lengthM": 29050,
      "segments": [ { "from": "kafd", "to": "ar-rabi", "distanceM": 3204, "seconds": 227, "geometry": [[lat,lng], …] }, … ],
      "snapOffsets": [28, 12, …]               // بُعد كل محطة عن المسار (م) — للفحص
    }
  },
  "lineOrder": ["1","2","3","4","5","6"],
  "transfers": [ { "station": "kafd", "from": "1", "to": "4", "minutes": 7 }, … ],
  "params": { "cruiseKmh": 65, "stopPenaltySec": 50, "transferMinutes": 5, … }
}
```

كيف تُبنى المقاطع: تُسقَط كل محطة عمودياً على المسار الهندسي (بنافذة بحث متقدمة لضمان الترتيب)، ثم يُقطع المسار عند نقاط الإسقاط؛ فتحصل كل وصلة بين محطتين متجاورتين على هندستها الحقيقية ومسافتها على طول السكة وزمنها التقديري `distance / cruise + stopPenalty`.

## محرك التوجيه (`RMRouter`)

- رسم بياني: عقدة لكل زوج (محطة، مسار). حواف الركوب بين المحطات المتجاورة على نفس المسار (الزمن التقديري)، وحواف التبديل بين مسارات المحطة نفسها (زمن التبديل، + عقوبة كبيرة في وضع «أقل تبديل»).
- Dijkstra من جميع عقد محطة البداية إلى أي عقدة لمحطة الوصول.
- النتيجة `itinerary`: `legs[]` (المسار، المحطات، الاتجاه = الطرف الذي يتجه إليه القطار، المسافة، الدقائق، الهندسة)، `transfers[]`، `totalMinutes`, `stops`, `transferCount`, `stations[]`.
- `describeItinerary(network, itinerary, 'ar' | 'en')` → تعليمات نصية خطوة بخطوة بجموع عربية صحيحة.

## الاستخدام البرمجي

```js
const net = require('./src/network'), router = require('./src/router');
const NET = net.buildNetwork({ stations, lines, shapes, config });   // أو JSON.parse(dist/riyadh-metro-network.json)
const trip = router.planRoute(NET, 'jeddah-road', 'airport-t1-2', { mode: 'fastest' });
console.log(router.describeItinerary(NET, trip, 'ar').join('\n'));
```

في المتصفح تُحمَّل نفس الملفات كـ `<script>` وتتوفر على `window.RMGeo / RMNetwork / RMRouter / RMLinks / RMKml / RMGeoJson`.

## سطر الأوامر

```
node scripts/route.js المركز المالي المتحف الوطني
node scripts/route.js "Jeddah Road" "Airport Terminals 1-2" --en --fewest
node scripts/route.js kafd an-naseem --json
node scripts/route.js --list
node scripts/route.js --near 24.7114 46.6745
```

## إضافة أو تعديل محطة

1. أضف/عدّل السجل في `data/stations.json` (معرّف slug جديد فريد).
2. أدرج المحطة في موضعها الصحيح ضمن `stations[]` للمسار في `data/lines.json`.
3. `npm run build` ← يفشل البناء إن كانت المحطة بعيدة عن المسار الهندسي (> 400 م) أو خارج ترتيبها، ويعيد توليد كل الملفات.
4. `npm test`.

---

## النقل العام — `data/bus/` · `data/districts.json` · `data/park-and-ride.json`

### `data/bus/stops.json` — 3,010 محطة توقّف

```jsonc
{
  "id": "b41090",                       // ثابت: b + كود المحطة في المصدر
  "code": "41090",                      // كود لوحة المحطة (يظهر على الأرض)
  "name": { "en": "Ali Ibn Abi Talib 18 B", "ar": "علي بن أبي طالب 18 ب" },
  "lat": 24.654694, "lng": 46.754313,   // WGS84
  "shelter": "brt",                     // brt | ac | ac-large | open | pole | pole-standard | metro | terminal | unknown
  "stage": "4",                         // مرحلة التطوير: 1…5.2 | "beyond-5.2" | null
  "operating": true,                    // false لمرحلة «بعد 5.2» (تُعرض ولا تُستخدم في التوجيه)
  "district": "al-safaa",               // معرّف الحي من districts.json
  "districtApprox": false,              // true = خارج كل مضلّع، أُسندت إلى أقرب حي
  "nearMetro": { "station": "kacst", "distanceM": 177 }   // اختياري: أقرب محطة مترو ضمن 450 م
}
```

### `data/bus/routes.json` — 88 مساراً

```jsonc
{
  "id": "11", "number": 11, "type": "brt",          // brt | main | sector | community
  "color": "#E8552D",
  "name": { "ar": "الربيع ↔ الخرج", "en": "Ar Rabi ↔ Al Kharj" },
  "origin": { "ar": "الربيع", "en": "Ar Rabi" }, "destination": { "ar": "الخرج", "en": "Al Kharj" },
  "loop": false, "stage": "partial",
  "headwayMin": 7, "speedKmh": 24,                  // تقديرات من config.json → busModel
  "lengthM": 38805, "runtimeMin": 97, "stopCount": 29, "uniqueStops": 55,
  "plannedStops": 3, "brtStops": 48,
  "directions": [1, 2], "bidirectional": true,
  "stops": ["b41068", "..."],                       // ترتيب الإسقاط على المسار (كل الاتجاهات)
  "dirs": {
    "1": { "shape": "11-1", "shapeLengthM": 39050, "stops": ["b41068", "..."], "along": [0, 210, "..."],
           "segments": [{ "from": "b41068", "to": "b41064", "meters": 210, "seconds": 32 }],
           "lengthM": 38805, "maxOffsetM": 41 }
  }
}
```

> `dir: "r"` يعني «الاتجاه المعاكس» مشتقاً من المسار الوحيد المنشور (59 مساراً باتجاه واحد فقط في المصدر).

### `data/bus/shapes.json`

```jsonc
{ "shapes": { "11-1": [[24.7875, 46.66162], "…"] }, "updated": "…" }  // [lat, lng] مبسّطة للعرض (6 م)
```

### `data/districts.json` — 133 حياً

```jsonc
{
  "id": "al-olaya", "name": { "ar": "العليا", "en": "Al Olaya" },
  "approx": false,                                   // حدود تقريبية؟
  "centroid": [24.68663, 46.68745], "bbox": [[24.66, 46.65], [24.71, 46.72]],
  "geometry": { "type": "Polygon", "coordinates": [[[46.73, 24.64], "…"]] },   // GeoJSON [lng, lat]
  "stops": 68, "routes": ["181", "…"], "brtStops": 0, "plannedStops": 24
}
```

### `data/park-and-ride.json`

```jsonc
{
  "summary": { "ar": "…", "en": "…" },
  "rules": { "freeMinutes": 15, "freeHoursWithTransit": 12, "hourlyAfterFreeSar": 10, "maxHours": 48, "speedLimitKmh": 10 },
  "sites": [{ "station": "sab-bank", "lines": ["1"], "capacity": 592, "confidence": "reported" }],  // 17 موقعاً
  "busParking": { "count": 4 }, "sources": [{ "label": "…", "url": "…", "note": "…" }]
}
```

## نموذج التوجيه متعدد الوسائط (`RMTransit`) — `src/transit.js`

```js
const tr = require('./src/transit');
const model = tr.build({ network, bus, districts, parkAndRide, config });

tr.plan(model, from, to, { mode: 'fastest' | 'fewest-transfers', modes: ['metro', 'bus', 'walk'], maxWalkM: 1200 });
tr.alternatives(model, from, to, opts);     // الأسرع · الأقل تبديلاً · مترو فقط · حافلات فقط (بعد إزالة التكرار)
tr.search(model, 'العليا', 8);               // محطات + مواقف + مسارات + أحياء + معالم
tr.nearby(model, lat, lng, 5, 900);          // نقاط صعود قريبة (مترو + حافلة)
tr.interchangeRanking(model);                // محطات المترو مرتّبة بعدد مسارات الحافلات ضمن 450 م
tr.districtStops(model, 'al-olaya');         // محطات التوقّف داخل حي
```

- `from`/`to`: `{kind:'station'|'stop'|'place', id}` أو `{kind:'coord', lat, lng, name}`.
- الساق: `{type:'walk'|'metro'|'bus', minutes, meters, geometry, fromName, toName, …}`؛ للحافلة `route, dir, stopsIds, fromStop, toStop`؛ للمترو `line, stations, fromStation, toStation`.
- التكلفة: زمن الركوب + نصف التردد المتوقع + دقيقة صعود + دقيقة تبديل في نفس الموقف، و45 دقيقة إضافية لكل تبديل في وضع «أقل تبديل».
- الرسوم: `dist/gtfs/riyadh-transit-gtfs.zip` — يبنيه `src/node/transit-exports.js` من النموذج نفسه، وتتحقق منه `test/transit.test.js`.
