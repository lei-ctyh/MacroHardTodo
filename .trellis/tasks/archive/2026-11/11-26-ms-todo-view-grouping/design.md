# 设计：视图分组

## 边界

- 只改前端渲染与派生数据，不动同步协议、数据库文件格式、Tauri 命令。
- 分组规则全部放在 `src/lib/views.ts` 的纯函数里，便于单测；`MainPane` 只负责取数、折叠状态和渲染。
- 侧栏的列表分组（`TaskGroup`）与本次「任务分组」无关，不复用、不修改。
- 新增的分组折叠状态只存本地 `settings`，不参与 WebDAV 同步（与 `collapsedGroups` 一致）。

## 数据流

```
db + view
  → tasksForView()            // 计划内改为包含已完成任务
  → searchTasks(visible)      // 搜索过滤
  → sectionsForView(db, view, visible)  // 新增：0 个或多个分组
  → 渲染：分组标题 + 组内 TaskRow（不启用拖拽）
  → completedTasksForView(db, view)     // 新增：底部已完成任务
  → searchTasks(completed) → 「已完成 N」折叠区
```

列表视图保持原路径：`sectionsForView` 返回空数组时走现有的平铺 + DnD 渲染。

## 契约

```ts
// views.ts
export interface TaskSection {
  key: string;      // list:<id> | overdue | today | tomorrow | next5 | later | other
  title: string;    // 组标题；全部/已完成为列表原始名（含 emoji）
  tasks: Task[];    // 已按当前视图排序
}

/** 需要分组的视图返回分组；平铺视图返回 [] */
export function sectionsForView(db: DB, view: View, tasks: Task[]): TaskSection[];

/** 底部已完成区；返回 [] 表示该视图不显示已完成区 */
export function completedTasksForView(db: DB, view: View): Task[];

/** 计划内日期桶；导出便于单测 */
export function plannedBucketKey(
  task: Task,
  today: string,
  tomorrow: string,
  next5End: string,
): "overdue" | "today" | "tomorrow" | "next5" | "later";

/** 计划内「接下来 5 天」的标题：M月d日,周X到M月d日,周X */
export function plannedRangeTitle(start: Date, end: Date): string;
```

### sectionsForView 规则

- `view.type === "list"` / `myday` / `important` → `[]`（平铺）。
- `completed` → 按 `listId` 分组（分组对象是 `tasksForView` 返回的已完成任务），组内保持 `completedAt` 倒序。
- `planned` → 五个桶，顺序：`overdue, today, tomorrow, next5, later`；空桶不返回；桶内用 `sortTasks(bucket, sort)` 排序。
  - 生效日期 = `dueDate ?? iso(reminderAt)`；`< today` 逾期、`=== today` 今天、`=== tomorrow` 明天、`<= today + 6` 接下来 5 天、否则以后。
  - 标题：`已逾期` / `今天` / `明天` / `plannedRangeTitle(today+2, today+6)` / `以后`。
  - 计划内的 `tasks` 来自包含已完成任务的 `tasksForView`，已完成任务与未完成任务同桶混排、一起计数。
- `all` / `completed` → 按 `listId` 分组：
  - 组顺序由 `listSections(activeLists(db), activeGroups(db))` 展开得到（未分组列表在前，然后按分组顺序），`list.order` 决定组内列表顺序。
  - 组标题 = 列表原始名称（`TaskList.name`，保留开头 emoji）。
  - 只保留所属列表仍存在的任务；找不到列表的任务直接跳过，不建「其他」组。
  - 组内排序：`all` 用 `sortTasks(tasks, sort)`；`completed` 保持传入的 `completedAt` 倒序（手动排序时）。
- 数量：`all` 和 `planned` 渲染（`section.tasks.length`）；`completed` 不渲染。

### completedTasksForView 规则

- `list`：该列表全部已完成任务，`completedAt` 倒序（与现状一致）。
- `myday`：`completed && myDay === todayISO()`，倒序。
- `important`：`completed && importance === "high"`，倒序。
- `planned` / `all` / `completed`：`[]`（计划内把已完成留在日期组里；全部不显示已完成区；已完成视图本身是分组列表）。

## 组件

新增 `src/components/SectionHeader.tsx`：

```tsx
<button
  type="button"
  className="section-title"
  aria-expanded={!collapsed}
  onClick={onToggle}
>
  {collapsed ? <ChevronRightIcon size={16} /> : <ChevronDownIcon size={16} />}
  <span className="section-title-text">{title}</span>
  {count != null ? <span className="section-count">{count}</span> : null}
</button>
```

- `count` 可选：`all` / `planned` 传数量，`completed` 不传。
- `MainPane` 用它渲染所有组标题和「已完成 N」。
- 分组视图（`all` / `completed`）内 `rowProps` 不传 `listName`；计划内的日期组仍显示来源列表，保持现状。
- 折叠状态：`settings.collapsedSections?: Record<string, string[]>`，key 为 `viewKey(view)`，value 为已折叠的 `section.key`。新增 store action `toggleSection(viewKey, sectionKey)`（内部走 `updateSettings`，仅本地）。
- 「已完成」区的 key 固定为 `completed`。
- 切换视图时天然隔离；重启后恢复。
- `src/components/TaskRow.tsx`：myDay 的 meta 从只有 `<SunIcon />` 改为图标 + 「我的一天」文字。

## 数据层改动

- `tasksForView("planned")` 去掉 `!t.completed` 过滤，让已完成任务留在日期组内（侧栏计数继续用 `smartCounts`，只算未完成）。
- `deleteList(id)`：不再软删除任务，而是把该列表的**全部任务（含已完成）**移动到 `DEFAULT_LIST_ID`：
  - 目标列表当前最大 `order` 之后按原相对顺序追加 `order`（如 `maxOrder + 1...`），避免与默认列表现有任务交错。
  - 只跳过 `deletedAt` 的任务，其他字段（`completed`、`completedAt`、`myDay` 等）保持不变。
  - 列表本身仍然软删除；默认列表不可删除的早退逻辑保留。
  - 迁移顺序：先改任务 `listId`，再软删除列表，保证同一事务内不会出现孤儿任务。

## CSS

- 把现有 `.suggestion-title` / `.suggestion-block` 重命名为语义化的 `.section-title` / `.section-block`，保留全部尺寸：高 36px、圆角 4px、14px/400、16px 箭头、间距 8px、`margin-bottom: 10px`、主题感知填充（`rgba(255,255,255,.7)`）。
- 新增 `.section-count`：`margin-left: 2px; color: inherit; opacity: .72; font-variant-numeric: tabular-nums;`。
- `.section-block` 的 `margin-top: 11px; padding-top: 2px;` 不变（与胶囊上方 13px 间隙一致）。
- 按钮化后重置：`border: none; font: inherit; cursor: pointer; user-select: none;`。
- 删除已无用的 `.suggestion-title button` 规则。

## 取舍

- 折叠状态持久化 vs 会话内：选持久化，成本只是一个可选 settings 字段，且与侧栏分组行为一致。
- 全部视图的组标题直接用列表原始名（含 emoji），不再分离 emoji 渲染：截图里就是 `😊111`。
- 计划内改为包含已完成任务、不留底部已完成区：与截图一致；旧数据无需处理，过期清理继续由 `autoPurgeCompletedDays` 负责。
- 计划内日期范围标题用固定格式 `M月d日,周X到M月d日,周X`，不依赖 locale，避免不同环境格式漂移。
- 已完成视图的组标题不带数量：与截图一致。

## 风险与回滚

- 风险：分组后 `DndContext` 只应包裹列表视图，避免在智能视图里误启用拖拽；`sortable` 判断保持 `view.type === "list"` 不变。
- 风险：计划内包含已完成任务后，空状态判断、搜索、排序都要以「含已完成」的新列表为准，避免已完成任务被二次过滤。
- 风险：`deleteList` 把任务移到默认列表时 `order` 冲突 → 追加到默认列表现有最大 `order` 之后；历史遗留的孤儿任务直接跳过。
- 风险：折叠状态 key 冲突 → 统一 `${viewKey}:${section.key}`。
- 回滚：纯前端改动，revert 提交即可；`collapsedSections` 为可选字段，旧数据不受影响（当前无发布版本，无需迁移）。
