import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./Modal";
import { DateTimePicker } from "./DateTimePicker";
import { WEEKDAY_NAMES } from "../lib/recurrence";
import { dayLabel } from "../lib/dates";
import type { RecurrenceRule } from "../lib/model";
import { CalendarIcon, ChevronDownIcon, CloseIcon } from "./icons";

const FREQ_LABELS: { value: RecurrenceRule["freq"]; label: string }[] = [
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
];

export function RepeatDialog({
  rule,
  dueDate,
  onCancel,
  onSave,
}: {
  rule?: RecurrenceRule;
  dueDate?: string;
  onCancel: () => void;
  onSave: (rule: RecurrenceRule) => void;
}) {
  const fallbackDay = dueDate
    ? new Date(`${dueDate}T00:00:00`).getDay()
    : new Date().getDay();
  const [freq, setFreq] = useState<RecurrenceRule["freq"]>(
    rule?.freq ?? "weekly",
  );
  const [interval, setIntervalValue] = useState(rule?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(
    rule?.byWeekday?.length ? rule.byWeekday : [fallbackDay],
  );
  const [endDate, setEndDate] = useState<string | undefined>(rule?.endDate);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitRect, setUnitRect] = useState<DOMRect | null>(null);
  const [endPicker, setEndPicker] = useState(false);
  const [endRect, setEndRect] = useState<DOMRect | null>(null);
  const unitButtonRef = useRef<HTMLButtonElement>(null);
  const unitMenuRef = useRef<HTMLDivElement>(null);
  const endButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!unitOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (unitMenuRef.current?.contains(target)) return;
      if (unitButtonRef.current?.contains(target)) return;
      setUnitOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setUnitOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [unitOpen]);

  const toggleWeekday = (index: number) => {
    setWeekdays((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      if (next.size === 0) next.add(index);
      return [...next].sort((a, b) => a - b);
    });
  };

  const toggleUnit = () => {
    if (unitOpen) {
      setUnitOpen(false);
      return;
    }
    const rect = unitButtonRef.current?.getBoundingClientRect();
    if (rect) setUnitRect(rect);
    setUnitOpen(true);
  };

  const toggleEndPicker = () => {
    if (endPicker) {
      setEndPicker(false);
      return;
    }
    const rect = endButtonRef.current?.getBoundingClientRect();
    if (rect) setEndRect(rect);
    setEndPicker(true);
  };

  const save = () => {
    onSave({
      freq,
      interval: Math.max(1, interval || 1),
      byWeekday: freq === "weekly" ? weekdays : undefined,
      endDate,
      totalOccurrences: rule?.totalOccurrences,
      occurrenceIndex: rule?.occurrenceIndex,
    });
  };

  return (
    <>
      <Modal
        title="重复周期…"
        narrow
        onClose={onCancel}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn" onClick={onCancel}>
              取消
            </button>
            <button type="button" className="btn primary" onClick={save}>
              保存
            </button>
          </>
        }
      >
        <div className="repeat-dialog">
          <div className="detail-repeat-row">
            <span className="detail-select-wrap">
              <button
                ref={unitButtonRef}
                type="button"
                className="detail-select detail-select-button"
                aria-expanded={unitOpen}
                onClick={toggleUnit}
              >
                {FREQ_LABELS.find((item) => item.value === freq)?.label}
                <ChevronDownIcon size={16} />
              </button>
            </span>
            <label className="detail-interval">
              <span>间隔</span>
              <input
                type="number"
                min={1}
                className="detail-number"
                value={interval}
                onChange={(e) =>
                  setIntervalValue(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
          </div>

          {freq === "weekly" ? (
            <div className="detail-weekdays">
              {WEEKDAY_NAMES.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className={`detail-weekday ${
                    weekdays.includes(index) ? "on" : ""
                  }`}
                  onClick={() => toggleWeekday(index)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="detail-picker-wrap">
            <button
              ref={endButtonRef}
              type="button"
              className={`detail-date-trigger ${endDate ? "" : "muted"}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={toggleEndPicker}
            >
              <CalendarIcon />
              <span>{endDate ? dayLabel(endDate) : "选择结束日期"}</span>
              {endDate ? (
                <span
                  className="clear-btn"
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEndDate(undefined);
                  }}
                >
                  <CloseIcon />
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </Modal>

      {unitOpen && unitRect
        ? createPortal(
            <div
              ref={unitMenuRef}
              className="detail-select-menu portaled"
              style={{
                left: unitRect.left,
                top: unitRect.bottom + 4,
                width: unitRect.width,
              }}
              role="listbox"
            >
              {FREQ_LABELS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={item.value === freq}
                  className={item.value === freq ? "active" : undefined}
                  onClick={() => {
                    setFreq(item.value);
                    setUnitOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      {endPicker && endRect
        ? createPortal(
            <div
              className="date-picker-portal"
              style={{ left: endRect.left, top: endRect.bottom + 6 }}
            >
              <DateTimePicker
                initialDate={endDate ?? dueDate}
                withTime={false}
                onCancel={() => setEndPicker(false)}
                onSave={(date) => {
                  setEndDate(date);
                  setEndPicker(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
