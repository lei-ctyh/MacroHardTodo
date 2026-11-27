# Implementation Plan: Settings Page Redesign

## Ordered Checklist

1. **Model & Store Foundations**
   - [ ] Update `src/lib/model.ts`: add `ToggleableSmartViewId` and the 8 new `Settings` fields + `DEFAULT_SETTINGS`.
   - [ ] Create `src/lib/sound.ts`: implement `playCompletionChime()` via Web Audio API with safe fallback.
   - [ ] Update `src/lib/views.ts`: add `isTaskInMyDay` and `isSmartViewVisible`; wire `showDueTodayInMyDay` into `tasksForView`, `completedTasksForView`, `smartCounts`, `myDaySuggestions`, and `myDaySuggestionGroups`.
   - [ ] Update `src/store/useStore.ts`:
     - Update `normalizeDb()` to merge new settings and nested `smartListVisibility`.
     - Replace `"settings"` in `DialogKind` with `settingsOpen` (`openSettings`, `closeSettings`).
     - Add `confirm` (`confirmDelete`, `closeConfirm`).
     - Update `focusQuickAdd()` to close `settingsOpen`.
     - Update `addTask()` for `addTasksOnTop`.
     - Update `toggleImportance()` for `moveStarredToTop`.
     - Update `toggleComplete()` to call `playCompletionChime()` when `playCompletionSound` is enabled and marking complete.

2. **UI Components & Shared Helpers**
   - [ ] Add shared avatar helper (`src/components/useAvatar.ts`) for reading `settings.avatar` and picking/clearing an image (used by both `Sidebar` and `SettingsPage`).
   - [ ] Create `src/components/ConfirmDialog.tsx` using `<Modal narrow>`.
   - [ ] Create `src/components/SettingsPage.tsx` with sticky `← 设置` top bar, profile header, Fluent toggle switches (`开`/`关`), vertical theme radio buttons, General / Theme / Smart Lists / Notifications / Sync & Migration / Data / About sections, and fixed `dataDir` status handling.
   - [ ] Delete `src/components/SettingsDialog.tsx`.
   - [ ] Update `src/App.tsx`: render `SettingsPage` full-window when `settingsOpen`, render `ConfirmDialog`, handle Escape for Settings.
   - [ ] Update `src/components/Sidebar.tsx`: open Settings via `openSettings()`, filter smart items with `isSmartViewVisible`, wire list & empty-group delete through `confirmDelete`, reuse `useAvatar`.
   - [ ] Update `src/components/MainPane.tsx`: wire ViewMenu list delete through `confirmDelete`.
   - [ ] Update `src/components/TaskDetail.tsx`: wire task delete through `confirmDelete`; reflect auto-included `dueDate === todayISO()` state in My Day row.
   - [ ] Update `src/components/DateTimePicker.tsx`: read `weekStartsOn` from store settings.

3. **Styling (`src/styles.css`)**
   - [ ] Replace old modal-only `.settings-*` styles with full-page `.settings-page`, `.settings-topbar`, `.settings-scroll`, `.settings-content`, `.settings-profile`, `.settings-section`, `.toggle-switch` (`开`/`关`), `.theme-radio-group` / `.theme-radio`, smart-list rows, data actions, and responsive + dark-mode rules.

4. **Unit Tests & Verification**
   - [ ] Add `tests/settings-preferences.test.ts` covering:
     - `addTasksOnTop` (`true` inserts at top, `false` appends at bottom)
     - `moveStarredToTop` (`true` moves starred task to top, un-starring keeps order; `false` leaves order unchanged)
     - `isSmartViewVisible` (per-list toggle + `autoHideEmptySmartLists` + active-view grace rule)
     - `showDueTodayInMyDay` (`tasksForView`, `completedTasksForView`, `smartCounts`, `myDaySuggestions`, `myDaySuggestionGroups` for both `true` and `false`)
     - `normalizeDb` backward compatibility with legacy DB missing new `Settings` fields
   - [ ] Run validation checks:
     - `tsc --noEmit -p tsconfig.json`
     - `vitest run`
     - `vite build`
   - [ ] Visually inspect the running dev app (light & dark mode, Settings page navigation, sub-modals, toggles, confirm dialog).

5. **Spec Update & Wrap-Up**
   - [ ] Update `.trellis/spec/frontend/` (`directory-structure.md`, `component-guidelines.md`, `state-management.md`) to document `SettingsPage`, `ConfirmDialog`, and new local preferences.

## Validation Commands

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/vitest/vitest.mjs run
npm run build
```

## Risky Files & Rollback Points

- `src/lib/views.ts` — touches My Day task inclusion and counts; verify all existing `tests/grouping.test.ts` and `tests/sort.test.ts` pass unchanged.
- `src/store/useStore.ts` — `normalizeDb` and `order` calculation in `addTask`/`toggleImportance`; verify `tests/delete-list.test.ts` and `tests/default-list.test.ts` stay green.
- `src/styles.css` — ensure dark mode (`:root[data-theme="dark"]`) and narrow layout (`≤760px`) contrast and spacing match existing design tokens.
