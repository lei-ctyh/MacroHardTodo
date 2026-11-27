import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { activeLists, type Task } from "../lib/model";
import { myDaySuggestionGroups, stepProgress } from "../lib/views";
import { splitLeadingEmoji } from "../lib/emoji";
import { dueDateLabel, todayISO } from "../lib/dates";
import { CloseIcon, PlusIcon } from "./icons";

export function SuggestionPanel({
  noAnim,
  onClose,
  onOpenTask,
}: {
  noAnim?: boolean;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const db = useStore((s) => s.db);
  const setMyDay = useStore((s) => s.setMyDay);
  const toggleComplete = useStore((s) => s.toggleComplete);

  const groups = useMemo(() => myDaySuggestionGroups(db), [db]);
  const listNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of activeLists(db)) {
      const display = splitLeadingEmoji(list.name);
      map.set(list.id, display.emoji ? display.text || display.emoji : list.name);
    }
    return map;
  }, [db]);

  return (
    <aside className={`suggest-panel ${noAnim ? "no-anim" : ""}`}>
      <div className="suggest-head">
        <div className="suggest-head-title">建议</div>
        <span className="spacer" />
        <button className="icon-btn" onClick={onClose} title="关闭建议">
          <CloseIcon />
        </button>
      </div>
      <div className="suggest-scroll">
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="big">暂无建议</div>
            <div>列表里未安排的任务会出现在这里</div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.title} className="suggest-group">
              <div className="suggest-group-title">{group.title}</div>
              {group.tasks.map((task) => (
                <SuggestionRow
                  key={task.id}
                  task={task}
                  listName={listNames.get(task.listId) ?? ""}
                  onOpen={() => onOpenTask(task.id)}
                  onAdd={() => setMyDay(task.id, todayISO())}
                  onComplete={() => toggleComplete(task.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function SuggestionRow({
  task,
  listName,
  onOpen,
  onAdd,
  onComplete,
}: {
  task: Task;
  listName: string;
  onOpen: () => void;
  onAdd: () => void;
  onComplete: () => void;
}) {
  const { done, total } = stepProgress(task);
  const today = todayISO();
  const overdue = Boolean(task.dueDate && task.dueDate < today);

  return (
    <div className="suggest-row" onClick={onOpen}>
      <button
        className="suggest-circle"
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        title="标记完成"
        aria-label="标记完成"
      />
      <div className="suggest-main">
        <div className="suggest-title">{task.title}</div>
        <div className="suggest-meta">
          <span>{listName}</span>
          {total > 0 ? (
            <span>
              · 第 {done} 步，共 {total} 步
            </span>
          ) : null}
          {task.dueDate ? (
            <span className={overdue ? "overdue" : ""}>
              · {dueDateLabel(task.dueDate)}
            </span>
          ) : null}
        </div>
      </div>
      <button
        className="icon-btn suggest-add"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="加入我的一天"
        aria-label="加入我的一天"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
