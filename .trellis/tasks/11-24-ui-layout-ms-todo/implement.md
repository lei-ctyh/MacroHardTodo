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
   - [ ] Move the `THEME_COLORS` import to `ViewMenu`.

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
- [ ] New `GroupRow.tsx`: whole-row click toggles collapse (rename input excluded, caret stops propagation), inline rename only via the right-click menu (no double-click rename), hover menu (重命名 / 删除组), droppable section, and press/release feedback (`0.985` while held, 200ms spring-back with overshoot on release). Empty groups get `group-section-empty`: hover/drop/press apply to the whole section (header + empty hint) as one rounded block, clicking the hint toggles too, and right-click anywhere in the section opens the group menu (with menu-internal right-clicks stopped).
- [ ] `styles.css`: use the same press/release transform on `.nav-item` (0.985 while held, spring-back on release) so smart-list/default/custom-list selection matches the group header.
- [ ] `Sidebar.tsx`: render ungrouped lists + group sections; bottom row `[+ 新建列表][□+ 创建新组]`; one `DndContext` with per-section `SortableContext`s and `group:<id>` droppables; `onDragEnd` → `reorganizeLists`. The inline new-list input commits on Enter **and** blur via a shared `commitNewList` (empty name cancels), Escape cancels.
- [ ] `SortableListRow`: right-click custom lists opens 重命名列表 (inline sidebar input), 将列表移动到… (flyout with the groups plus 移出分组, only when groups exist), and 删除列表 (danger, Delete hint). Move via `moveList(listSections(...), id, group:<target>)` → `reorganizeLists`, expanding a collapsed target; the default list has no context menu.
- [ ] Both group and list right-click menus render through `createPortal(..., document.body)` with `position: fixed` + cursor coordinates. They must not live inside `.group-section`/`.nav-item`/`.sidebar`: those carry press-spring transforms (and the sidebar a drawer transform at ≤760px), which turn a transformed ancestor into the containing block for `fixed`, making the menu appear offset/scaled until the transform settles. Portaled menus use z-index 100 to stay above the drawer.
- [ ] `styles.css`: `.list-menu` 220px, `.list-submenu` 190px opening to the right with a 8px hover bridge, `.nav-rename-input`, and the group/list context-menu layout.
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

## Content Header Title Metrics

- [ ] `styles.css`: `.main-header` padding `40px 32px 6px 44px`; `.main-title` 28px/36px/600; `.header-title-icon` 32×36 + 8px gap; `.header-emoji` 26px; `.task-scroll` padding `10px 56px 8px 64px`; `.quick-add` margin `16px 66px 16px 64px`.
- [ ] `MainPane.tsx`: render the fixed icon slot (theme emoji → list color dot/list glyph → smart-view icon via `SMART_TITLE_ICONS`); make `subtitle` My Day-only and render it conditionally.
- [ ] Verify with CDP: icon x=44, title text x=84, task card x=64 on 计划内 / 任务 / AAA; My Day still shows the date; other views show no count subtitle.
- [ ] Task-group headers (先前 / 今天 / 稍后) remain out of scope for this pass.
- [ ] `MainPane.rowProps`: pass the source list name for all smart views, including 已完成, so completed rows show the same meta (`0/1 AAA`, `date AAA`) as the other smart views; list views still omit it.
- [ ] `styles.css`: move the card surface to `.task-row` globally using `--task-card-bg/border/hover/selected/shadow`; remove all `.main.on-image .task-row`, task text, checkbox, star, drag-handle, and task-scroll overrides. Verify 重要 and 计划内 task rows compute the same card styles.
- [ ] `styles.css`: give `.task-scroll` a stable thin scrollbar (`scrollbar-gutter: stable`, `scrollbar-width`, `::-webkit-scrollbar` rules, theme-aware thumb), set its bottom padding to 8px, give the QuickAdd a 16px top margin (outside the scroll) and a 66px right margin so it aligns with the cards after the scrollbar gutter. Verify the scrollbar is visible, the scroll/add-bar gap is 16px at the top and bottom, and the last task scrolls fully above the add bar.
- [ ] `QuickAdd.tsx`: add the `editing` state and replace the always-on input with a normal trigger button + an editing task-card row (checkbox, input, hint); wire click/nonce focus, Enter add, Escape/empty-blur exit.
- [ ] `styles.css`: add `--quick-add-hover` (#e8eceb light / #333333 dark), the trigger/label/plus styles, the `.quick-add.editing` task-card surface and image-theme overrides; remove the old `:focus-within` blue inset. Verify normal/hover/editing states with CDP.

## Sidebar Sections & Fixed Icons

- [ ] `src/lib/emoji.ts`: `splitLeadingEmoji(name)` takes the first grapheme (Intl.Segmenter) and, when it is pictographic/flag/keycap, returns `{ emoji, text }`; no match returns `{ text }`. Cover it in `tests/emoji.test.ts` (plain names, leading emoji, whitespace, digits/hash/letters, keycap, flag, ZWJ, skin tone, emoji-only, empty).
- [ ] Use the split at render time only: sidebar row icon/label, content title icon/text, smart-view list meta and suggestion meta. The stored name keeps the emoji; sidebar and title rename inputs start from the raw name. A stored theme emoji is the fallback icon.
- [ ] `Sidebar.tsx`: order 我的一天 → 任务 → 重要/计划内/全部/已完成; make the default 任务 row always render `HomeIcon` (ignore its theme emoji).
- [ ] `MainPane.tsx`: title icon precedence becomes smart fixed icon → default-house → custom-list theme emoji/color/glyph; import `HomeIcon`.
- [ ] `ViewMenu.tsx`: add `fixedIcon` (smart targets + `DEFAULT_LIST_ID`); show the full theme grid for every view, drop stored/selected emoji for system targets, and keep the custom-image delete; the emoji picker and standalone `ThemePicker` modal are removed.
- [ ] Verify the sidebar order, fixed sun/star/calendar/infinity/check/house icons in sidebar and title, the planned title no longer showing its stored apple, and the custom list retaining its emoji/color.

## Top-right Menu Redesign

- [ ] `ViewMenu.tsx`: replace the narrow menu/accordion with a wide two-panel popover — 380px main panel (排序依据 row, 5-column theme grid, custom-list actions) + an independent sort flyout. Use `@floating-ui/react` `useFloating` (`offset(12)`/`flip`/`shift`, left-start with right-start fallback) plus `useHover`/`safePolygon`/`useClick`/`useFocus`; remove the primary panel's `onMouseLeave` close. The flyout is not a flex sibling, so the primary panel never moves, the pointer can enter the flyout without a flicker loop, and the offset leaves a gap instead of overlapping the panel.
- [ ] Theme grid: add a dashed `+` upload tile (Tauri dialog + `attachmentAdd`) and a custom image tile with a hover/focus top-right delete (clears preset/image, keeps custom list emoji/color); pass the resolved `bgUrl` from `MainPane` for the image preview; show a small error when the image is >12MB or the upload fails.
- [ ] Apply theme presets/colors through the store without closing the menu; `fixedIcon` targets drop the emoji; sort/rename/delete still close it.
- [ ] Theme colors / list-color removal: delete `TaskList.color`, `setListColor`, the sidebar list tint, and the title color dot; rename the palette to `THEME_COLORS` (14 named subtle `linear-gradient(135deg, …)` washes with stops close to the base, 7 mid + 7 light with `light: true`); add `ListTheme.color`; render it in `MainPane.mainStyle`; add `themeLight`/`.on-light` CSS so light gradients use dark title/subtitle/header actions/empty/suggestion/scrollbar; show the 14 gradient tiles in the ViewMenu grid between 无 and the presets; remove the 列表颜色 section and palette CSS.
- [ ] Empty states: add `themePhoto`/`on-photo`; render `EmptyIllustration` (tilted white paper + accent header + view badge + sparkles) inside an `.empty-inner` wrapper for the non-MyDay system views and custom lists; keep the WelcomeCard art for My Day. `.empty-state` uses `min-height:100%` + flex centering so its vertical position matches the My Day welcome; put the `.on-photo` frosted background on `.empty-inner` (not the full-height `.empty-state`) with a fixed `width:320px` (`max-width:100%`, 16px horizontal padding) so every list's box matches, and `rgba(0,0,0,.64)` + `blur(18px)` so it is not too see-through. Use the Microsoft hint copy: 全部 `所有未完成的任务都会显示在此处。`, 计划内 `此处显示带有截止日期或提醒的任务。`, 重要 `尝试为一些任务加星标，以便在此处查看它们。`. Color themes render no box; `.on-light` keeps dark text.
- [ ] Remove the `ThemePicker` modal: delete `ThemePicker.tsx`, `MainPane`'s `themeOpen`/`themeTarget`/`onTheme`, the ViewMenu's 更多主题… entry and `PaletteIcon`, the `THEME_EMOJIS` export, and the modal-only emoji/tile-name CSS. Keep a custom list's existing theme emoji display-only.
- [ ] `icons.tsx`: add `CalendarPlusIcon` (已添加) and `GripVerticalIcon` (我的顺序) for the sort flyout.
- [ ] `styles.css`: `.main-menu` flex anchor; `.main-menu-panel` 280px; `.sort-flyout` absolute; theme grid 5 columns / 44px tiles / 9px gaps; menu palette swatches; active/checked states. Keep the outer `.main-menu`/`.sort-flyout` transform-free (fade only) but animate the inner `.main-menu-panel` (`popIn`) and `.sort-flyout-inner` (`sortIn` scale/fade) so Floating UI's first-frame coordinates stay correct. Verify the panels open side-by-side under the More button and that theme clicks leave the menu open.

## Responsive Sidebar

- [ ] `App.tsx`: add `matchMedia("(max-width: 760px)")`/`narrow`/`sidebarOpen`; close on wide; close on view changes; Escape closes the drawer; render `.sidebar-scrim`; pass `onOpenSidebar` + `narrow` to `MainPane`.
- [ ] `MainPane.tsx`: render `.mobile-sidebar-toggle` (MenuIcon) before the header text; default My Day's suggestion closed when `narrow`; keep `suggestOpen` toggle behavior.
- [ ] `styles.css`: ≤760px sidebar drawer (`min(320px,84vw)`, fixed, z 90, slide transition), hidden resizer, z-89 scrim, two-row header grid with the hamburger; ≤1100px fixed right overlays for `.suggest-panel`/`.detail-panel` (`min(380px,92vw)`, z 85) so the main is never squeezed.
- [ ] `src-tauri/tauri.conf.json`: minWidth 880 → 520; verify via CDP emulation at 620px and note that the dev window needs a restart for the native min width.

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
