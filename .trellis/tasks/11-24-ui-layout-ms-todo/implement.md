# Implementation Plan — Align UI layout with Microsoft To Do

## Ordered Checklist

1. **Model + settings**
   - [ ] Add `SortKey` and `Settings.sortBy?: Record<string, SortKey>` to `src/lib/model.ts`.
   - [ ] Add `sortBy: {}` to `DEFAULT_SETTINGS`.
   - [ ] Add `setSort(key, sort)` to the store interface and implementation (`src/store/useStore.ts`), updating settings immediately.

2. **Sort helper + tests**
   - [ ] Add `SORT_OPTIONS`, `viewKey(view)`, and `sortTasks(tasks, sort)` to `src/lib/views.ts`.
   - [ ] Add `tests/sort.test.ts` covering: manual order unchanged, importance first, due dates with nulls last, added ascending, alpha with Chinese titles, and stable tie-breaks.
   - [ ] Gate: `npm test` passes.

3. **Sidebar**
   - [ ] Add always-visible search box under `.brand`, bound to `query` / `setQuery`; Escape clears and blurs.
   - [ ] Remove the "列表" header `+`; add a "新建列表" action at the sidebar bottom (above 同步/设置) that opens the existing inline input.
   - [ ] Remove the per-list `...` menu (color palette, rename, delete) and its state/props from `SortableListRow`.
   - [ ] Keep drag-and-drop, counts, emoji/color-dot icons, and active state.
   - [ ] Move the `LIST_COLORS` import to `ThemePicker`.

4. **MainPane header + ViewMenu**
   - [ ] Remove `searchOpen`, the search box, and the palette button from the header.
   - [ ] Add a `MoreIcon` menu button on every view; keep the lightbulb suggestion button on My Day only.
   - [ ] Create `src/components/ViewMenu.tsx` with the item sets from `design.md`, inline sort accordion, check mark, outside-click/Escape close.
   - [ ] Apply `sortTasks` between `tasksForView` and `searchTasks`.
   - [ ] Disable drag unless `view.type === "list" && !query.trim() && sort === "manual"`.
   - [ ] Add inline title rename (Enter/blur commit, Escape/empty cancel).
   - [ ] Open `ThemePicker` from the menu for list and My Day targets.
   - [ ] Gate: `npx tsc --noEmit` passes.

5. **ThemePicker**
   - [ ] Add a "列表颜色" section for list targets using `LIST_COLORS` and `setListColor`; hide it for My Day.
   - [ ] Reorder sections to 颜色 → 图标（emoji）→ 背景; keep immediate apply semantics.

6. **Styles**
   - [ ] Add `.sidebar-search`, `.menu-wrap`/`.main-menu`, and inline rename input styles.
   - [ ] Remove `.nav-more` rules if unused; keep `.palette` for the theme dialog.

7. **Validation**
   - [ ] `npm test` — all suites pass, including the new sort tests.
   - [ ] `npx tsc --noEmit` — clean.
   - [ ] `npm run build` — Vite build succeeds.

8. **Manual verification (dev app already running)**
   - [ ] Search placement/filtering/clear/switch-view behavior.
   - [ ] Menu contents per view; sort persistence after view switch and app restart.
   - [ ] Drag only under 我的顺序.
   - [ ] Rename/delete/theme/color flows.
   - [ ] My Day suggestion button and panel.
   - [ ] No regressions in quick add, theme backgrounds, task detail.

9. **Wrap-up**
   - [ ] Decide whether `.trellis/spec/frontend/` needs an update for the new menu/search conventions.
   - [ ] Review `git diff` before commit; do not commit until the user asks.

## Follow-up Delta — Theme on Every View

- [ ] Generalize `ThemeTarget` in `ThemePicker.tsx` to `{ type: "list"; list } | { type: "smart"; id: SmartViewId }`.
- [ ] Add `smartThemeKey(id)` / `smartTheme(db, id)` to `themes.ts`; keep `mydayTheme` working via the same key.
- [ ] `ThemePicker`: title/initial/apply for smart targets; color section only for lists.
- [ ] `MainPane`: `themeTarget` non-null for every view; resolve theme for list and smart views.
- [ ] `ViewMenu`: always render 主题; remove the `hasTheme` condition.
- [ ] Update the frontend spec lines that describe theme availability.
- [ ] Re-run `npm test`, `npx tsc --noEmit`, `npm run build`.

## List Groups

- [ ] `model.ts`: add `TaskGroup`, `TaskList.groupId?`, `DB.groups`, `collapsedGroups` default, `createDB` seed, `activeGroups`.
- [ ] `merge.ts`: merge groups with LWW + tombstones; include groups in `fingerprint`.
- [ ] `useStore.ts`: `addGroup`, `renameGroup`, `deleteGroup` (keeps lists, clears `groupId`), `reorganizeLists`, `toggleGroupCollapsed`; include groups in `normalizeDb`.
- [ ] `icons.tsx`: add `SquarePlus` (创建新组).
- [ ] New `GroupRow.tsx`: chevron collapse, inline rename, hover menu (重命名 / 删除组), droppable section.
- [ ] `Sidebar.tsx`: render ungrouped lists + group sections; bottom row `[+ 新建列表][□+ 创建新组]`; one `DndContext` with per-section `SortableContext`s and `group:<id>` droppables; `onDragEnd` → `reorganizeLists`.
- [ ] `styles.css`: group header/lists, drop highlight, footer row.
- [ ] Extend `tests/merge.test.ts` for group merge/tombstone and list `groupId` preservation.
- [ ] Update frontend specs (directory-structure, state-management, component-guidelines) for groups.

## Account Menu

- [ ] `Sidebar.tsx`: make the brand row a button with an account dropdown (同步 + 状态, 设置); outside-click/Escape close; reuse `.menu`.
- [ ] Remove 同步/设置 from `.sidebar-footer`; keep only the new-list/new-group row.
- [ ] `styles.css`: `.brand-wrap`, clickable brand hover, account menu positioning.
- [ ] Update `component-guidelines.md` for the new sidebar footer/account-menu convention.

## Resizable Sidebar + Highlight Radius

- [ ] `model.ts`: add `Settings.sidebarWidth?: number` with default 240.
- [ ] `App.tsx`: sidebar width state from settings, inline `--sidebar-w`, `.sidebar-resizer` pointer drag (clamp 200–420), persist on pointer up, double-click reset.
- [ ] `styles.css`: `.sidebar-resizer`; nav metrics: scroll padding 6px sides, highlight `inset: 2px 0`, radius 3px, bar 3×16 at left 1px, icon padding-left 12px; `--nav-selected`/`--nav-accent`.
- [ ] Update `state-management.md` / `component-guidelines.md` for the resizer and width preference.
- [ ] Re-run `npm test`, `npx tsc --noEmit`, `npm run build`.

## Windows Title Bar (DWM)

- [ ] `lib.rs`: declare `DwmSetWindowAttribute`, add `apply_caption_theme`, register the `set_titlebar_theme` command, apply the light default in `setup`.
- [ ] `api.ts`: `setTitleBarTheme(dark)` wrapper.
- [ ] `App.tsx`: call it inside the theme effect for light/dark/system changes.
- [ ] Run `cargo check`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- [ ] Restart the dev app and verify the native title bar color with a full-window screenshot.

## Avatar Picker

- [ ] `model.ts`: add `Settings.avatar?: ThemeImage`.
- [ ] `Sidebar.tsx`: remove the chevron; row opens the menu; avatar button uses `open()` + `attachmentAdd` + `updateSettings`; resolve the avatar via `attachmentRead` with icon fallback.
- [ ] `styles.css`: `.brand-avatar` button/image styles; remove `.brand-caret`.
- [ ] Update `component-guidelines.md` / `state-management.md` for the avatar setting and row interaction.

## Default List & Smart Views

- [ ] `model.ts`: `DEFAULT_LIST_ID`, `ensureDefaultList`, seed `createDB`, `SMART_VIEWS` → `all`.
- [ ] `useStore.ts`: normalizeDb ensures the default list; deleteList refuses the default; QuickAdd default target.
- [ ] `views.ts`: `tasksForView`/`smartCounts`/`headerInfo` use `all`; labels 全部.
- [ ] `Sidebar.tsx`: 我的一天, 智能列表 section, fixed 任务 row, custom lists only; default excluded from DnD.
- [ ] `MainPane.tsx` / `ViewMenu.tsx`: target default list, `fixed` menu hides rename/delete, empty states use `all`.
- [ ] README/spec updates; add `tests/default-list.test.ts`.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run build`; reload the app and verify the default list appears and QuickAdd targets it.

## Validation Commands

```bash
npm test
npx tsc --noEmit
npm run build
```

No Rust changes, so `cargo check` is not required.

## Risky Files / Rollback Points

- `src/components/MainPane.tsx` — header, sorting, rename, menu wiring. Roll back this file alone to restore the old header.
- `src/components/Sidebar.tsx` — removing the per-list menu and moving new-list entry. Roll back together with `MainPane` if actions become unreachable.
- `src/lib/views.ts` + `tests/sort.test.ts` — pure logic; revert leaves UI on manual order.
- `src/lib/model.ts` / `useStore.ts` — optional `settings.sortBy`; older code ignores it, so rollback is safe.

## Follow-up Checks Before `task.py start`

- [ ] `prd.md` has no open questions and testable acceptance criteria.
- [ ] `design.md` and `implement.md` exist and match the PRD.
- [ ] `implement.jsonl` and `check.jsonl` contain real spec entries.
- [ ] User approves the final planning summary.
