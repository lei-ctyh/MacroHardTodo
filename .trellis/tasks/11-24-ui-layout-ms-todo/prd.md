# Align UI layout with Microsoft To Do

## Goal

Make navigation, search, and top-right actions mirror Microsoft To Do so the app feels familiar, while keeping the existing local-first features (quick add, themes, drag ordering, My Day suggestions).

## Background and Confirmed Facts

- Search lives in the content header today (`MainPane.tsx`), toggled by a search icon; it filters only the current view via `searchTasks(allForView, query)`.
- The content header exposes search, My Day suggestions (lightbulb), and theme (palette) buttons.
- The sidebar holds smart views, a "列表" section with `+`, and a per-list `...` menu containing 10 colors, rename, and delete (`Sidebar.tsx`).
- List / My Day backgrounds (including gradients) are edited in the ViewMenu theme section.
- `tasksForView` returns tasks in each view's base order; drag-and-drop reorders tasks for list views. There is no user-selectable sort today.
- `setView` already clears `query` on view change (`useStore.ts:256`).
- `deleteList` switches to the first remaining list when the active list is deleted (`useStore.ts:341`).
- No release tag exists: **data compatibility and migrations are out of scope** until the first tagged release.

## Requirements

- R1: Search box moves into the sidebar above the smart views and is always visible. It keeps current-view filtering; no global cross-list search.
- R2: Every view shows one menu button at the top right of the content header.
- R3: The menu contains sorting and theme on every view. List views additionally expose rename and delete.
- R4: My Day keeps a dedicated suggestion (lightbulb) button next to the menu; the existing suggestion panel behavior is unchanged.
- R5: Layout follows Microsoft To Do: sidebar order is search → smart views → lists → new list, and the content header keeps title/subtitle plus the top-right actions.
- R6: List management is consolidated into the top-right menu: rename, theme, and delete leave the per-list sidebar `...` menu, which is removed.
- R7: The former list-color palette becomes gradient theme backgrounds inside the ViewMenu theme grid; there is no separate list color field/UI.
- R8: "新建列表" moves from the "列表" section header to the bottom of the sidebar.
- R9: Sorting offers Microsoft To Do's five options: 重要 / 截止日期 / 已添加 / 字母顺序 / 我的顺序. Each view remembers its own choice; default is 我的顺序. Drag reordering is disabled when a non-manual sort is active.
- R10: Preserve existing behavior: quick add, theme backgrounds and uploads, detail pane, shortcuts, and task creation.

## Key Decisions

- Sort state is stored per view key (`list:<id>` / `smart:<id>`) in local settings; it does not sync across devices.
- Themes are per view: lists keep `list.theme`; smart views store their theme in `db.shared` (`mydayTheme` for My Day, `theme:<smartId>` for the rest). Every view, including 重要 / 计划内 / 任务 / 已完成, can pick a background.
- "已添加" sorts by `createdAt` ascending (oldest first); "字母顺序" uses `localeCompare("zh-CN")`; "重要" puts high importance first; "截止日期" puts missing dates last.
- Renaming a list happens inline in the content header, not in the sidebar.
- The ViewMenu theme section becomes the single place for a view's identity/background: gradients, images, and uploads; an existing custom-list emoji stays display-only.
- Deleting the last remaining list stays disabled, matching current behavior.
- Groups are ordered by creation in this iteration; group drag-reordering is not included.
- Deleting a group is non-destructive to lists and tasks: affected lists get `groupId: undefined`.

## Acceptance Criteria

- [ ] The sidebar shows an always-visible search box above the smart views; typing filters only the current view; Escape/clearing restores the unfiltered list; switching views clears the query.
- [ ] Every view has exactly one top-right menu button; list, My Day, and other smart views show the item sets defined in R3.
- [ ] The sort submenu lists the five options with the current one checked; choosing one reorders tasks deterministically and survives view switches and app restart.
- [ ] Drag reordering works only when the current view uses 我的顺序; otherwise drag is disabled.
- [ ] Rename from the menu edits the header title in place, commits on Enter/blur, and cancels on Escape or empty input.
- [ ] Delete from the menu removes the list and switches to another list; it stays disabled for the last list.
- [ ] Theme is available from the menu on every view and persists per view; list color is editable only for list views.
- [ ] My Day still shows the suggestion button and opens the existing panel.
- [ ] The sidebar bottom row shows "新建列表" plus a "创建新组" icon button.
- [ ] Creating a group inserts "未命名的组" and enters inline rename; empty input keeps the default name.
- [ ] Groups collapse/expand, remember their state locally, and show their lists indented beneath the header.
- [ ] Lists can be dragged into, out of, and between groups; the resulting group membership and order persist after restart.
- [ ] Deleting a group keeps its lists and tasks, moving the lists to the ungrouped section.
- [ ] Groups merge across WebDAV devices using the same LWW + tombstone rules, and deleting a list or group does not resurrect on sync.
- [ ] Dragging the sidebar divider changes the width within 200–420px, the content reflows, and the width persists after restart; double-click resets it to 240px.
- [ ] The selected-row highlight uses the Microsoft-matched geometry and accent color from R21.
- [ ] The account row has no chevron; clicking the row opens the menu, and clicking the avatar opens an image picker that persists the chosen avatar locally.
- [ ] Existing data gains the fixed 任务 list on load while `AAA` remains a custom list under 列表.
- [ ] QuickAdd from smart views or My Day creates the task in 任务; QuickAdd from a custom list keeps it there.
- [ ] The sidebar shows 我的一天, 重要 / 计划内 / 全部 / 已完成, the fixed 任务 row, a divider, and custom lists/groups — with no text section headings; the 任务 list menu has no rename/delete.
- [ ] Group headers have no `...`; right-click opens 重命名组 / 新建列表 plus 删除组 (empty) or 取消分组列表 (non-empty); 新建列表 adds a list inside the group.
- [ ] On Windows 11 the native title bar background matches the sidebar in light and dark themes, and keeps native minimize/maximize/close behavior.
- [ ] Clicking the brand/account area opens a dropdown with 同步 (showing status) and 设置; the footer contains only the new-list/new-group row.
- [ ] Existing list actions (rename/theme/delete) and sorting continue to work for grouped lists.
- [ ] The content header title matches the Microsoft To Do metrics: 32px/40px, icon starts at 44px, title text at 84px, task cards and QuickAdd at 64px; the 计划内 page has no count subtitle, while My Day keeps its date.
- [ ] Tasks in every smart view, including 已完成, show the source list name in the task meta; list views omit it because the list is already the context.
- [ ] The 重要 page (with a background theme) and the 计划内 / 已完成 pages (without one) render task rows with identical background, 1px border, 4px radius, 2px gap, shadow, padding, hover, and selected styles.
- [ ] With more tasks than fit, a thin scrollbar is visible, the scroll viewport and add bar keep a 16px page-background gap at every scroll position, scrolling to the bottom leaves the last task fully above the add bar with a ~24px gap, and the add bar's right edge lines up with the task cards.
- [ ] QuickAdd shows a normal trigger row (`＋ 添加任务`, no hint), a `#e8eceb` hover in the light theme, and an editing task card with an empty checkbox, focused input, and `Enter 添加`; Enter adds, Escape/empty blur returns to the trigger.
- [ ] The sidebar order is 我的一天 → 任务 → 重要/计划内/全部/已完成 → divider → custom lists/groups; 任务 uses the fixed house and the four smart rows use their fixed icons in both sidebar and title.
- [ ] The theme grid shows 无 + 14 gradient color backgrounds (7 mid + 7 light) + 8 image presets for every view; there is no separate 列表颜色 anywhere. The standalone theme dialog and 更多主题… are gone; selection applies inline; the custom list's existing emoji stays display-only.
- [ ] The top-right menu opens a wide main panel; 排序依据 opens a right-side flyout with icons and the active check; the theme grid (colors/images) applies without closing; custom lists keep 重命名/删除列表.
- [ ] The theme grid has a `+` tile that uploads a background image; a custom image renders as an active extra tile with a hover/focus top-right delete that removes the image; preset/color/无 tiles have no delete.
- [ ] Light gradients (浅蓝/淡紫/浅粉/杏/薄荷/浅青/浅灰) render dark titles/date/header actions/empty-state/suggestion text/scrollbar; the 7 mid gradients keep white title text.
- [ ] `npm test` and `npx tsc --noEmit` pass.

## List Groups (added 2026-11-24)

- R11: The sidebar bottom row shows "新建列表" on the left and a "创建新组" icon button on the right, matching the Microsoft To Do layout.
- R12: Creating a group inserts "未命名的组" and immediately enters inline rename; an empty name falls back to "未命名的组".
- R13: Groups render as collapsible sections above/below ungrouped lists; the header shows an expand/collapse chevron and the group name.
- R14: Lists can be dragged into and out of groups; group order and list order are both persisted.
- R15: Group collapse state is remembered locally per group.
- R16: Group actions include inline rename and delete. Deleting a group removes the group only: its lists become ungrouped and keep their tasks.
- R17: Groups participate in WebDAV merge with the same LWW + tombstone rules as lists; `TaskList.groupId` is part of the list entity.
- R18: The existing list actions (rename/theme/delete) remain available from the top-right menu.
- R19: 同步 and 设置 move from the sidebar footer into a dropdown opened by clicking the brand/account area at the top. The footer keeps only 新建列表 and 创建新组.
- R20: The sidebar width is user-resizable by dragging the divider between the sidebar and the content, like Microsoft To Do. The width is clamped to a usable range, persists locally, and can be reset by double-clicking the divider.
- R21: The selected-row highlight matches Microsoft To Do's geometry: ~6px side gaps, 36px tall, small corner radius (~3px), with the 3×16px accent bar inside the highlight at its left edge.
- R22: On Windows 11, the native title bar uses DWM caption/text colors matching the sidebar (`#F3F3F3` light / `#252423` dark) and updates when the app theme changes. Non-Windows builds are a no-op.
- R23: The account row has no chevron; clicking the row opens the account menu, while clicking the circular avatar opens an image picker and saves a local avatar (falling back to the app icon when none is set).
- R24: Add a fixed default list `任务` (`DEFAULT_LIST_ID`). It always exists, sits in the basic section next to 我的一天, cannot be renamed or deleted, and is not draggable/groupable. Its icon is always the fixed house. New tasks created from smart views or My Day go into it; new tasks created while viewing a custom list stay in that list.
- R25: Reorganize the sidebar without text section headings: 我的一天, then the fixed 任务 default list, then 重要 / 计划内 / 全部 / 已完成, a divider, then custom lists/groups. The former all-tasks smart view is renamed 全部; `AAA` and other user-created lists are custom.
- R26: Group headers have no `...` button. Right-clicking a group opens a context menu with 重命名组 / 新建列表, plus 删除组 for empty groups or 取消分组列表 for non-empty groups; 新建列表 creates a list inside that group and selects it. Lists without an emoji use a blue list-lines icon. Expanded groups show an up chevron and empty groups show the indented drag hint.

## Content Header Title (added 2026-11-24)

- R27: The list/smart-view title is 32px with a 40px line box and 600 weight; the header uses `40px 32px 6px 44px` padding. The title starts with a fixed 32px icon slot + 8px gap, so icon x=44px and text x=84px relative to the content pane.
- R28: The title icon is fixed for system entries: My Day sun, 重要 star, 计划内 calendar, 全部 infinity, 已完成 circled check, and the default 任务 house. Only custom lists use their theme emoji, color dot, or list-lines glyph. On a theme background the system icon inherits the white title color.
- R29: Task rows and QuickAdd use a 64px left inset (56px right), placing the task cards 20px right of the title text like Microsoft To Do. Non-MyDay views no longer show the `N 项任务` / `N 项已完成` subtitle; My Day keeps its date subtitle.

## Task Card Surface (added 2026-11-25)

- R30: `.task-row` is a card globally (`background: var(--task-card-bg)`, 1px border, 4px radius, 2px gap, `--task-card-shadow`); `.task-row:hover` and `.selected` use `--task-card-hover` / `--task-card-selected`.
- R31: `.main.on-image` no longer overrides task-row background, text, checkbox, star, or drag-handle styles, and no longer changes the task-scroll padding; the 重要 page (with a background) and the 计划内 page (without one) render the same task cards.

## Task-list Overflow (added 2026-11-25)

- R32: When tasks overflow the content pane, the task list keeps a visible, thin, theme-aware scrollbar in a stable gutter. The add-task bar has a 16px top margin outside the scroll, so the scroll viewport and the bar always have a page-background gap (the old 20px scroll-content padding was invisible at the top of the list). The last task can be scrolled fully above the bar with a ~24px gap. The add-task bar's right edge aligns with the task cards (right inset = 56px + scrollbar gutter, currently 66px), so the bottom of the list reads as one continuous surface instead of a clipped row under the add bar.

## QuickAdd States (added 2026-11-26)

- R33: Normal (not editing, not hovering) is a trigger row with a plus and `添加任务` label in `--text` (`--text-secondary` plus), no hint. It keeps the existing translucent bar surface; hovering uses `#e8eceb` in the light theme (a dark token in dark mode, `#e8eceb` on image backgrounds).
- R34: Clicking the trigger (or the global quick-add shortcut) enters editing: the bar becomes a task-card surface with an empty checkbox, a focused input (placeholder `添加任务`), and the `Enter 添加` hint. Enter adds and keeps editing; Escape or blur with an empty value returns to the trigger. The editing card uses the task-card tokens, not the old blue focus inset.

## Sidebar Sections & Fixed Icons (added 2026-11-27)

- R35: The sidebar reads as three visual sections without text headings: basic (我的一天, fixed 任务), smart lists (重要, 计划内, 全部, 已完成), and user content (custom lists/groups) after the divider. The fixed 任务 row moves above the smart lists.
- R36: System-entry icons are fixed and cannot be replaced: the sidebar and content title use the sun (My Day), star (重要), calendar (计划内), infinity (全部), circled check (已完成), and house (任务). Smart views and the default 任务 show only background presets in the menu's theme grid; theme emoji no longer overrides their icons (stored emoji is ignored and cleared on apply). A custom list's icon is its existing theme emoji or the accent list glyph; there is no separate list color.

## Top-right Menu (added 2026-11-27)

- R37: The top-right menu is a wide two-panel menu modeled on Microsoft To Do: the main panel has a 排序依据 row, a 主题 grid, and the list's own actions; the 排序依据 flyout opens to the right of the main panel on hover/focus (and remains open on click), lists the sort options with icons and an active check, and closes when the pointer leaves the menu.
- R38: The theme grid shows 无背景 + 14 Microsoft-matched gradient color tiles (7 mid: 蓝/紫/玫红/红/绿/青/灰; 7 light: 浅蓝/淡紫/浅粉/杏/薄荷/浅青/浅灰) + the eight background presets (5 columns, active border) + a `+` upload tile. The gradients are deliberately subtle: 135° diagonal washes whose stops stay close to the base color (for example 蓝 `#7d97dd → #6c8cd5 → #5f7dc6`), matching the Microsoft color themes rather than high-contrast 3-stop gradients. Every view picks from the same background grid; there is no separate 列表颜色 row. Clicking a theme applies it without closing the menu. The standalone theme dialog and 更多主题… entry are removed; all theme editing lives in this grid/upload UI.
- R39: The menu's own actions are the app's (重命名 / 删除列表 on custom lists); the Microsoft-only 打印此列表 / 以电子邮件发送列表 / 固定到“开始” actions remain out of scope.
- R40: The theme grid's dashed `+` tile uploads a local background image (Tauri image dialog → attachment copy → theme image). A custom image appears as an extra tile before the `+`; it is active and shows a top-right delete button on hover/focus. Deleting clears the custom image (and preset/color) while preserving a custom list's existing emoji; preset/color/无 tiles have no delete affordance.
- R41: The separate list color feature is removed: `TaskList.color`, `setListColor`, the sidebar color tint, and the title color dot are gone. The former palette becomes `THEME_COLORS` (14 named CSS gradients) and `ListTheme.color` stores the gradient; the MainPane renders it as the page background.
- R42: `ThemeColor.light` marks the 7 light gradients. Their pages add `on-light`, switching the title, subtitle, header actions, empty state, suggestion title, and scrollbar to dark text/controls (like the reference's mint My Day page); the 7 mid colors keep the white on-image treatment.

## Out of Scope

- Global cross-list search.
- Microsoft To Do actions not present in this app (print, email list, pin to Start, share).
- Task date grouping headers (先前 / 今天 / 稍后) and their collapse behavior; the title sync does not add them.
- Task grouping by list in 全部 (the reference's 定期 / 学习 collapsible headers); the overflow pass keeps the flat list but makes it visibly scrollable.
- Syncing sort preferences across devices.
- Group drag-reordering, nested groups, and group-level themes/colors.
- Data migration or compatibility before the first tagged release.
