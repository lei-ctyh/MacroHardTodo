# Quality Guidelines

> Code quality standards for this project.

---

## Commands

| Check | Command |
|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` |
| Unit tests | `node node_modules/vitest/vitest.mjs run` |
| Rust | `cargo check` (cwd `src-tauri`) |
| Frontend build | `npm run build` |
| Installer | `npm run tauri build` (NSIS, currentUser) |
| Dev (hot reload) | `npm run tauri dev` |

Do not re-package the installer for every UI tweak — use `tauri dev`; build only at milestones.

---

## Required Patterns

- Pure logic in `src/lib/` with Vitest coverage for merge/recurrence/date boundaries.
- All persistence through `useStore.commit`; all I/O through `src/lib/api.ts`.
- Soft delete + `updatedAt`/`updatedBy` on every entity write.
- Design tokens in `styles.css`; no hard-coded hex values in components (data-driven colors excepted).
- New user-facing strings in Simplified Chinese; code and comments in English or Chinese matching the file.

---

## Forbidden Patterns

- **Microsoft assets**: no Microsoft To Do icons, images, logos, or the “Microsoft To Do” name in the product. UI may be inspired by it; assets must be original or open-source (lucide, our SVG backgrounds).
- Secrets in `DB` or `localStorage`: WebDAV/Graph credentials go to Windows Credential Manager (`secret.rs`).
- Direct `invoke(...)` in components; use `api.ts`.
- Mutating Zustand state in place.
- `any` and unsafe casts (see `type-safety.md`).
- Blocking the UI thread with large base64 work without a size guard (theme images warn above 12 MB).
- Removing the fixed bottom `QuickAdd` or showing it on the Completed page.

---

## Testing Requirements

- Merge changes (`merge.ts`) and recurrence changes (`recurrence.ts`) require a new Vitest case.
- Data-model changes require updating `normalizeDb` and at least a manual load of an old `todo-data.json`.
- UI changes: verify with `tauri dev`; when automation is needed, drive the app through CDP (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` for the installed app, headless Chrome for `npm run dev`) and keep temporary scripts, screenshots and test data in the project's gitignored `.test-artifacts/` — never in external directories such as `C:\software`.
- Rust command changes: `cargo check` plus a manual call through the UI.

---

## Code Review Checklist

- [ ] `tsc` and `vitest` pass; `cargo check` passes if Rust changed
- [ ] New persisted fields handled by normalize/merge
- [ ] No secrets in the document; no Microsoft assets
- [ ] Fixed bottom add bar present on all pages except Completed
- [ ] Theme/background behavior verified on a list and at least one smart view (if touched)
- [ ] Sync/import changes covered by tests or a documented manual scenario
- [ ] Chinese UI strings render; dark mode contrast OK
