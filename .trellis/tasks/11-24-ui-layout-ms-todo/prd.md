# Align UI layout with Microsoft To Do

## Goal

Make navigation, search, and top-right actions mirror Microsoft To Do so the app feels familiar, while keeping the existing local-first features (quick add, themes, drag ordering, My Day suggestions).

## Background and Confirmed Facts

- Search lives in the content header today (`MainPane.tsx`), toggled by a search icon; it filters only the current view via `searchTasks(allForView, query)`.
- The content header exposes search, My Day suggestions (lightbulb), and theme (palette) buttons.
- The sidebar holds smart views, a "列表" section with `+`, and a per-list `...` menu containing 10 colors, rename, and delete (`Sidebar.tsx`).
- List / My Day backgrounds and emoji are edited in `ThemePicker.tsx`.
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
- R7: List color selection moves into the theme dialog alongside emoji and background; the sidebar row keeps showing the emoji or color dot.
- R8: "新建列表" moves from the "列表" section header to the bottom of the sidebar.
- R9: Sorting offers Microsoft To Do's five options: 重要 / 截止日期 / 已添加 / 字母顺序 / 我的顺序. Each view remembers its own choice; default is 我的顺序. Drag reordering is disabled when a non-manual sort is active.
- R10: Preserve existing behavior: quick add, theme backgrounds and uploads, detail pane, shortcuts, and task creation.

## Key Decisions

- Sort state is stored per view key (`list:<id>` / `smart:<id>`) in local settings; it does not sync across devices.
- Themes are per view: lists keep `list.theme`; smart views store their theme in `db.shared` (`mydayTheme` for My Day, `theme:<smartId>` for the rest). Every view, including 重要 / 计划内 / 任务 / 已完成, can pick a background.
- "已添加" sorts by `createdAt` ascending (oldest first); "字母顺序" uses `localeCompare("zh-CN")`; "重要" puts high importance first; "截止日期" puts missing dates last.
- Renaming a list happens inline in the content header, not in the sidebar.
- The theme dialog becomes the single place for list identity: color, emoji, and background.
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
- R24: Add a fixed default list `任务` (`DEFAULT_LIST_ID`). It always exists, is shown separately from the 列表 section, cannot be renamed or deleted, and is not draggable/groupable. New tasks created from smart views or My Day go into it; new tasks created while viewing a custom list stay in that list.
- R25: Reorganize the sidebar without text section headings: 我的一天, then 重要 / 计划内 / 全部 / 已完成, then the fixed 任务 default list, a divider, then custom lists/groups. The former all-tasks smart view is renamed 全部; `AAA` and other user-created lists are custom.
- R26: Group headers have no `...` button. Right-clicking a group opens a context menu with 重命名组 / 新建列表, plus 删除组 for empty groups or 取消分组列表 for non-empty groups; 新建列表 creates a list inside that group and selects it. Lists without an emoji use a blue list-lines icon. Expanded groups show an up chevron and empty groups show the indented drag hint.

## Out of Scope

- Global cross-list search.
- Microsoft To Do actions not present in this app (print, email list, pin to Start, share).
- Syncing sort preferences across devices.
- Group drag-reordering, nested groups, and group-level themes/colors.
- Data migration or compatibility before the first tagged release.
