# Project Rules: VerticalTec Branch Install Check List (Replace POS – ThaiBev)

## Mandatory Workflow After Every Code Edit

Every time code in this repository is modified, you MUST complete all three steps below before finishing:

1. **Verify TypeScript & Build**
   ```powershell
   npx.cmd tsc --noEmit; if ($?) { npm.cmd run build }
   ```
   - Both `tsc --noEmit` and `next build` must exit with code `0`.

2. **Deploy to Vercel Production**
   ```powershell
   npx.cmd vercel deploy --prod --yes
   ```
   - Confirm `readyState: "READY"` for `https://vtec-tbcheck.vercel.app`.

3. **Commit & Push to GitHub (`origin/main`)**
   ```powershell
   git add .; if ($?) { git commit -m "<concise description>" }; if ($?) { git push origin main }
   ```
   - Repository: `https://github.com/kjvtec/tbchecklist`
   - Never commit `.env*`, `node_modules`, `.next`, or `.vercel` (keep `.gitignore` intact).

## Environment & Project Conventions

- **Windows PowerShell:** Always invoke `npm.cmd` and `npx.cmd` (not `npm` / `npx`), and chain dependent commands with `; if ($?) { ... }` instead of `&&`.
- **Protected Actions PIN:** Keep `ADMIN_PIN = "112233"` (`src/components/PinConfirmModal.tsx`) enforced for creating, duplicating, deleting documents, deleting items/sections, and saving Master Template.
- **Export Naming:** Always use `buildExportFileName(doc)` (`<ชื่อสาขา> Check List`) for PDF/Print `document.title`, Excel (`.xlsx`), and Word (`.docx`).
