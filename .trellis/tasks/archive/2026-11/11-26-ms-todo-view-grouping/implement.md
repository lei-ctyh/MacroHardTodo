# 执行计划：视图分组

前置：PRD 的 Open Questions 由用户确认后，`task.py start` 进入执行阶段。

## 1. 纯函数与测试

- [ ] `src/lib/views.ts`
  - `tasksForView("planned")` 去掉 `!t.completed` 过滤（已完成任务留在日期组）。
  - 新增 `TaskSection` 接口。
  - 新增 `sectionsForView(db, view, tasks)`：`planned` 日期桶、`all` / `completed` 按列表分组（顺序复用 `listSections`，跳过找不到列表的任务），其他视图返回 `[]`。
  - 新增 `plannedBucketKey(task, today, tomorrow, next5End)` 与 `plannedRangeTitle(start, end)`。
  - 新增 `completedTasksForView(db, view)`，规则见 design.md。
  - 复用 `sortTasks` 完成组内排序；不新增排序键。
- [ ] `src/store/useStore.ts`：`deleteList` 把任务移到 `DEFAULT_LIST_ID` 末尾而不是软删除；保持列表软删除。
- [ ] `tests/grouping.test.ts`
  - 计划内边界：昨天 / 今天 / 明天 / 今天+2 / 今天+6 / 今天+7；只有 `reminderAt` 的任务；已完成任务仍在组内且计数。
  - 日期范围标题：`11月28日,周六到12月2日,周三` 这类格式。
  - 全部：组顺序（未分组 → 分组）、组名保留 emoji、计数、找不到列表的任务被跳过。
  - 已完成：按列表分组、组内完成时间倒序。
  - 我的一天 / 重要 / 计划内 / 全部 / 已完成的 `completedTasksForView` 集合。
  - 搜索过滤后空组不返回。
- [ ] `tests/delete-list.test.ts`（或并入现有 store 测试）：删除列表后任务出现在默认列表末尾、`completed` 等字段保持、列表软删除。
- [ ] 验证：`npm test`

## 2. 组标题组件与样式

- [ ] 新建 `src/components/SectionHeader.tsx`（button + 箭头 + 标题 + 数量，`aria-expanded`）。
- [ ] `src/styles.css`
  - `.suggestion-title` → `.section-title`，`.suggestion-block` → `.section-block`，同步主题覆盖规则（`.main.on-image*`）。
  - 新增 `.section-count`。
  - 删除 `.suggestion-title button` 死规则。
- [ ] `src/components/MainPane.tsx`：「已完成 N」改用 `SectionHeader`，行为不变。
- [ ] 验证：`npm run build`，手动检查列表视图的已完成区样式/折叠与改动前一致。

## 3. 视图分组渲染

- [ ] `MainPane`
  - `const sections = useMemo(() => sectionsForView(db, view, visible), [db, view, visible])`。
  - 列表视图：保持现有 `DndContext` + `SortableContext` 平铺渲染。
  - 分组视图（`all` / `completed`）：按 section 渲染 `SectionHeader` + `TaskRow`，不包 DnD。
  - 计划内（`planned`）：按日期 section 渲染，已完成的 `TaskRow` 正常显示划线。
  - 全部 / 已完成分组内 `rowProps` 不传 `listName`；计划内保持传 `listName`。
  - 数量：全部和计划内给 `SectionHeader` 传 `count`；已完成不传。
  - 已完成区：`completedTasksForView` + 搜索过滤，放在最后；`planned`/`all`/`completed` 不渲染。
- [ ] `TaskRow`：myDay meta 改成图标 + 「我的一天」文字。
- [ ] 空状态：仍以 `visible.length === 0` 判断，不渲染空组。
- [ ] 验证：`npm test && npm run build`。

## 4. 折叠状态

- [ ] `src/lib/model.ts`：`Settings` 增加 `collapsedSections?: Record<string, string[]>`；`DEFAULT_SETTINGS` 不需要默认值（可选）。
- [ ] `src/store/useStore.ts`：新增 `toggleSection(viewKey: string, sectionKey: string)`，基于 `updateSettings`（仅本地）。
- [ ] `MainPane`：读取 `db.settings.collapsedSections?.[viewKey(view)] ?? []`，传给 `SectionHeader`。
- [ ] 验证：折叠「全部」的某个列表组 → 切视图再切回，状态保持；重启 app 后保持。

## 5. 手动回归（dev 构建）

- [ ] 任务 / 自定义列表：平铺、拖拽排序、已完成区、搜索。
- [ ] 删除列表：任务（含已完成）出现在默认「任务」列表末尾，列表消失，任务数据不丢。
- [ ] 我的一天：平铺 + 新「已完成 N」；日期副标题不变。
- [ ] 重要：平铺 + 「已完成 N」，只统计重要任务。
- [ ] 计划内：五个日期桶、日期范围标题、空桶隐藏、已完成任务留组内划线、提醒任务。
- [ ] 全部：按列表分组、组顺序与侧栏一致、计数、折叠、搜索后空组隐藏。
- [ ] 已完成视图：按列表分组、组顺序与侧栏一致、无数量、组内完成时间倒序、折叠正常、无底部已完成区。
- [ ] 任务行：「☀ 我的一天」文字显示正常，其他 meta 不受影响。
- [ ] 主题：默认 / 浅色渐变 / 深色主题下胶囊文字与填充对比度。
- [ ] 窄屏（≤760px）抽屉模式不回归。

## 6. 收尾

- [ ] `npm test`、`npm run build` 全绿。
- [ ] 更新 `.trellis/spec/frontend/` 中与分组/列表渲染相关的约定（如新增纯函数位置、组标题组件）。
- [ ] 提交前用 `git diff` 自查：无调试代码、无无关重命名、无 `dist/` 变更。

## 评审门

- 1 完成后：分组纯函数与测试先过一次 review（规则是否符合 PRD）。
- 3 完成后：四个视图手动截图对比参考图，再进入折叠状态实现。
- 6 完成后：整体 diff review 再提交。

## 回滚点

- 每个步骤独立提交或至少可独立 revert；回滚分组渲染不影响已完成区重构（两者解耦）。
- 若持久化折叠状态出问题：移除 `collapsedSections` 字段与 `toggleSection`，退回组件内 state，不影响分组规则。
