import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { todayISO } from "../lib/dates";
import { PlusIcon } from "./icons";

export function QuickAdd({
  listId,
  myDay,
  important,
  dueToday,
}: {
  listId?: string;
  myDay?: boolean;
  important?: boolean;
  dueToday?: boolean;
}) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const addTask = useStore((s) => s.addTask);
  const nonce = useStore((s) => s.quickAddNonce);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nonce > 0) setEditing(true);
  }, [nonce]);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    if (nonce > 0) ref.current?.select();
  }, [editing, nonce]);

  const submit = () => {
    if (!listId) return;
    const id = addTask({
      listId,
      title: value,
      myDay,
      importance: important ? "high" : "normal",
      dueDate: dueToday ? todayISO() : undefined,
    });
    if (id) {
      setValue("");
      ref.current?.focus();
    }
  };

  const cancel = () => {
    setValue("");
    setEditing(false);
  };

  return (
    <div className={`quick-add ${editing ? "editing" : ""}`}>
      {editing ? (
        <div
          className="quick-add-editing"
          onMouseDown={(e) => {
            if (e.target !== ref.current) {
              e.preventDefault();
              ref.current?.focus();
            }
          }}
        >
          <span className="checkbox add-task-checkbox" aria-hidden />
          <input
            ref={ref}
            value={value}
            placeholder={listId ? "添加任务" : "请先创建一个列表"}
            disabled={!listId}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                cancel();
              }
            }}
            onBlur={() => {
              if (!value.trim()) setEditing(false);
            }}
          />
          <span className="hint">Enter 添加</span>
        </div>
      ) : (
        <button
          type="button"
          className="quick-add-trigger"
          disabled={!listId}
          onClick={() => setEditing(true)}
        >
          <span className="plus">
            <PlusIcon />
          </span>
          <span className="quick-add-label">
            {listId ? "添加任务" : "请先创建一个列表"}
          </span>
        </button>
      )}
    </div>
  );
}
