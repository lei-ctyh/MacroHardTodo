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
  const addTask = useStore((s) => s.addTask);
  const nonce = useStore((s) => s.quickAddNonce);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nonce > 0) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [nonce]);

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

  return (
    <div className="quick-add">
      <span className="plus">
        <PlusIcon />
      </span>
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
          }
        }}
      />
      <span className="hint">Enter 添加</span>
    </div>
  );
}
