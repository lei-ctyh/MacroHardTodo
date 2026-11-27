# Customizable Profile Identity

## Goal

Replace the hardcoded placeholder identity (`本地用户` / `本地数据`) in `Sidebar` and `SettingsPage` with a customizable display name and smart subtitle (custom subtitle → configured WebDAV account → omitted), editable inline in `SettingsPage`.

## Confirmed Facts

- `src/components/Sidebar.tsx` currently hardcodes `本地用户` and `本地数据` in both the `.brand` header and `.account-menu` dropdown.
- `src/components/SettingsPage.tsx` currently hardcodes `本地用户` in `.settings-profile-name` and falls back to `本地数据` when `settings.webdavUser` is empty.
- `Settings` in `src/lib/model.ts` is local-only and normalized in `normalizeDb()` (`src/store/useStore.ts`); `avatar` is already stored locally under `db.settings.avatar`.

## Requirements

### R1. Local Profile Fields (`src/lib/model.ts`)
- Add optional local fields to `Settings`:
  - `profileName?: string`
  - `profileSubtitle?: string`
- Add a pure helper `profileDisplay(settings)` (in `src/lib/views.ts` or `src/lib/model.ts`) that computes:
  - `name`: `settings.profileName?.trim() || "MacroHard Todo"`
  - `subtitle`: `settings.profileSubtitle?.trim() || settings.webdavUser?.trim() || undefined`

### R2. Inline Editing in `SettingsPage`
- Display the resolved `name` (with subtle edit affordance on hover/focus) and `subtitle` (or subtle `"添加签名"` trigger on hover when empty) in `.settings-profile`.
- Clicking the name or edit button enters inline editing for `profileName` and `profileSubtitle` (clean inputs with Enter/blur save and Escape cancel; clearing either field restores the smart fallback).

### R3. Live Sync Across `Sidebar` and Account Menu
- `Sidebar` `.brand` and `.account-menu` `.account-head` read `profileDisplay(db.settings)`.
- When `subtitle` is `undefined`, omit `.brand-sub` / `.account-sub` so the single-line name centers cleanly next to the avatar without empty space or placeholder text.

## Out of Scope

- Syncing profile name/subtitle across devices via WebDAV (kept local-only like `avatar`)
- Cloud account login or authentication

## Acceptance Criteria

- [ ] No hardcoded `本地用户` or `本地数据` remains in `Sidebar.tsx` or `SettingsPage.tsx`.
- [ ] `profileDisplay` resolves custom name → `"MacroHard Todo"`, and custom subtitle → `webdavUser` → `undefined` (covered by unit test).
- [ ] Users can edit and clear display name and subtitle inline in `SettingsPage`, with immediate reflection in `Sidebar` and `.account-menu`.
- [ ] When subtitle is empty and WebDAV is unconfigured, the sidebar brand renders a cleanly centered single-line name.
- [ ] `tsc --noEmit`, `vitest run`, and `vite build` pass with zero errors.
