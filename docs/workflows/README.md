# سير عمل GitHub Actions · Workflows

## الوضع الحالي (2026-10-10)

| الملف | الحالة | المطلوب |
|---|---|---|
| `.github/workflows/pages.yml` | **مفعّل** ✅ (ينشر GitHub Pages عند الدفع إلى `main`) | إضافة سطر `npm ci` قبل `npm run build && npm test` — انسخ النسخة المحدّثة من [`pages.yml`](pages.yml) هنا |
| `ci.yml` | **غير مفعّل** ❌ | نقله إلى `.github/workflows/ci.yml` (الأمر بالأسفل) |

> ⚠️ **عطل مُكتشف:** ملف `ci.yml` كان موضوعاً في **جذر المستودع** لا في `.github/workflows/`،
> وGitHub Actions لا يقرأ إلا `.github/workflows/` — أي أن **CI لم يعمل قط**، رغم أن شارة README
> تشير إليه. النسخة المصحّحة هنا (`npm ci` + تخزين npm + رسالة خطأ أوضح عند تقادم المخرجات).

## التفعيل (مرة واحدة)

```bash
git mv docs/workflows/ci.yml .github/workflows/ci.yml        # كان في الجذر — لم يعمل قط
cp    docs/workflows/pages.yml .github/workflows/pages.yml   # يضيف npm ci للنشر
rm -rf docs/workflows
git commit -m "ci: enable the CI workflow and install dev dependencies" && git push
```

أو من واجهة GitHub: **Add file → Create new file** → المسار `.github/workflows/ci.yml` → الصق
محتوى [`ci.yml`](ci.yml)، وكرّر الأمر لـ `pages.yml`.

السبب في إيقافهما هنا: الاتصال الذي يفتح الـ Pull Request لا يملك صلاحية `workflows`
اللازمة للكتابة داخل `.github/workflows/` (رسالة `remote rejected … without workflows permission`).

## ماذا يفعل كل ملف

- **`ci.yml`** — عند كل دفع أو PR: `npm ci` (jsdom + axe-core لاختبارات المتصفح والوصولية) →
  `npm run build` → يفشل إن كانت مخرجات `dist/` أو `web/data` أو `web/lib` أو `web/icons` قديمة
  (البناء **حتمي**: نفس البيانات = نفس البايتات) → `npm test` (94 اختباراً).
- **`pages.yml`** — عند الدفع إلى `main`: يبني ويختبر ثم ينشر `web/` + `dist/` + `docs/` على
  GitHub Pages (فعّل أولاً: Settings → Pages → Source: **GitHub Actions**).

---

## English

`pages.yml` is already live in `.github/workflows/`; **`ci.yml` is not** — it was parked at the
repository root, where GitHub Actions never reads it, so CI has never run despite the README badge.
The corrected copies are in this folder. Move them with the commands above (or re-create them via
the GitHub web UI), then delete the folder.

They are parked here because the connection that opens the pull request lacks the `workflows`
permission needed to write to `.github/workflows/` (`remote rejected … without workflows permission`).
