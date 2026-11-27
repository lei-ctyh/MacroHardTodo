# Align TaskDetail Panel with Microsoft To Do

## Goal

Align the right-side `TaskDetail` panel's visual hierarchy and micro-interactions with Microsoft To Do: top-right close button, step indented dividers + vertical `⋮` action menu (promote to task / delete step), `下一步` focus morph from `+` to empty step circle `○`, active `已添加到“我的一天”` state with right `×`, muted past reminders, and clean centered footer (`创建于 …` + right `🗑`), while keeping the `标签` card below notes.

## Confirmed Facts

- `src/components/TaskDetail.tsx` currently renders cards in `.detail-scroll` with no top header close button; `.detail-footer` packs `创建于`, `完成于`, list `<select>`, `duplicateTask`, `deleteTask`, and `selectTask(null)` close button into one bottom bar.
- Step rows (`.step-row`) currently show a hover-only `×` delete button and no bottom divider; `.add-step-row` displays a static `PlusIcon` + `"添加步骤"` placeholder.
- The My Day row renders `"从我的一天移除"` in plain text without a trailing `×` clear button.
- The reminder row always highlights in `.accent` regardless of whether `task.reminderAt` is in the past (`< Date.now()`).
- `useStore` exposes `addTask`, `deleteStep`, `deleteTask`, `confirmDelete`, `setMyDay`, `selectTask`.

## Requirements

### R1. Top-Right Close Bar
- Add a clean `.detail-topbar` at the top of `.detail-panel` with a right-aligned `×` (`CloseIcon`) button to close the detail panel (`selectTask(null)`).

### R2. Steps &「下一步」Micro-Interactions
- Each `.step-row` renders a subtle bottom divider line indented under the text (starting after the checkbox, aligned cleanly like Microsoft To Do).
- Replace the hover `×` with a vertical `⋮` (`MoreVerticalIcon`) menu button on the right of each step row; clicking opens a compact portaled menu with:
  - `提升为任务` (creates a new task in `task.listId` with `step.title`, then deletes the step)
  - `删除步骤` (danger red, calls `deleteStep`)
- `.add-step-row` ("下一步"):
  - Idle state: accent-colored `+` icon + accent-colored `"下一步"` placeholder.
  - Focused / typing state: leading `+` morphs into an empty step circle (`○`, matching `.step-check` size/border) and placeholder clears cleanly; pressing `Enter` adds the step and keeps input focused; blurring when empty returns to idle `+ 下一步`.

### R3.「我的一天」Card Active State
- Not in My Day: muted `SunIcon` + muted `"添加到“我的一天”"`.
- Manually in My Day (`task.myDay === todayISO()`): accent `SunIcon` + accent `"已添加到“我的一天”"` + trailing `×` clear button (calls `setMyDay(task.id, null)`).
- Auto-included via due-today (`showDueTodayInMyDay` + `dueDate === todayISO()`): accent `SunIcon` + accent `"已添加到“我的一天”"` (clicking pins `setMyDay(task.id, todayISO())`, no misleading clear button since it's driven by `dueDate`).

### R4. Past Reminder Styling
- When `task.reminderAt` is set:
  - Upcoming (`task.reminderAt > Date.now()`): icon and main text use `.accent`.
  - Past (`task.reminderAt <= Date.now()`): icon and main text render in muted `--text-secondary` (matching Microsoft To Do's `在 19:00 时提醒我 / 昨天`), keeping the trailing `×` button.

### R5. Clean Footer & Retained Tag Card
- `.detail-footer`: centered `创建于 <createdAtLabel>` (or `已完成于 …` when completed) + right-aligned `🗑` (`TrashIcon`, routed through `confirmDelete`), removing the crowded list dropdown, duplicate button, and bottom close button.
- Retain the `.detail-block.detail-tags` card below notes.

## Out of Scope

- Drag-and-drop reordering of steps inside `TaskDetail`
- Changing the reminder/due/repeat popovers or `RepeatDialog`

## Acceptance Criteria

- [ ] `×` close button sits cleanly in the top-right header of `TaskDetail`.
- [ ] Step rows show indented bottom dividers and a `⋮` menu supporting「提升为任务」and「删除步骤」.
- [ ] `+ 下一步` shows accent `+` at rest and morphs to an empty circle `○` while focused/typing.
- [ ] Adding a task to My Day displays accent `已添加到“我的一天”` with a trailing `×` button to remove it.
- [ ] Past reminders render in muted secondary text/icon color; upcoming reminders stay highlighted in accent.
- [ ] Footer shows centered creation/completion text + right-aligned delete icon; `标签` card remains below notes.
- [ ] `tsc --noEmit`, `vitest run`, and `vite build` pass with zero errors.
