# سير عمل GitHub Actions (CI + GitHub Pages) · Workflows

هذان الملفان جاهزان لكن موضوعان هنا مؤقتاً، لأن الاتصال الذي فتح الـ Pull Request لا يملك صلاحية
`workflows` اللازمة لإنشاء ملفات داخل `.github/workflows/`.

**لتفعيلهما** (مرة واحدة، بعد الدمج) انقلهما إلى `.github/workflows/`:

```bash
git mv docs/workflows/ci.yml    .github/workflows/ci.yml
git mv docs/workflows/pages.yml .github/workflows/pages.yml
git commit -m "ci: enable GitHub Actions workflows" && git push
```

أو من واجهة GitHub: **Add file → Create new file**، اكتب المسار `.github/workflows/ci.yml`
والصق محتوى `docs/workflows/ci.yml`، وكرّر الأمر لـ `pages.yml`، ثم احذف هذا المجلد.

- `ci.yml` — عند كل دفع/PR: `npm run build` ثم يفشل إن كانت مخرجات `dist/`/`web/` قديمة، ثم `npm test`.
- `pages.yml` — عند الدفع إلى `main`: يبني وينشر `web/` + `dist/` + `docs/` على GitHub Pages
  (فعّل أولاً: Settings → Pages → Source: **GitHub Actions**).

---

These two workflows are parked here because the GitHub connection that opened the pull request lacks the
`workflows` permission required to write to `.github/workflows/`. After merging, move them with the
`git mv` commands above (or re-create them via the GitHub web UI), then delete this folder.
