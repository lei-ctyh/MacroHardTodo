import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import { zhCN } from "react-day-picker/locale/zh-CN";
import "react-day-picker/style.css";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";
import { dateToISO } from "../lib/dates";
import { useStore } from "../store/useStore";

function parseISO(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

/** 替换组件自带的原生 select：换成可定制的下拉菜单 */
function CalendarDropdown({
  options = [],
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>("button.active");
    if (menu && active) {
      menu.scrollTop = Math.max(
        0,
        active.offsetTop - menu.clientHeight / 2 + active.clientHeight / 2,
      );
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="date-picker-dropdown">
      <button
        type="button"
        className="date-picker-dropdown-btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {current?.label ?? ""}
        <ChevronDownIcon size={12} strokeWidth={1.5} />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="date-picker-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={String(option.value) === String(value)}
              className={
                String(option.value) === String(value) ? "active" : undefined
              }
              disabled={option.disabled}
              onClick={() => {
                onChange?.({
                  target: { value: String(option.value) },
                } as unknown as ChangeEvent<HTMLSelectElement>);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

export function DateTimePicker({
  initialDate,
  initialTime,
  withTime = true,
  onCancel,
  onSave,
}: {
  initialDate?: string;
  initialTime?: string;
  withTime?: boolean;
  onCancel: () => void;
  onSave: (date: string, time: string) => void;
}) {
  const weekStartsOn = useStore((s) => s.db.settings.weekStartsOn ?? 1);
  const initial = parseISO(initialDate) ?? new Date();
  const [selected, setSelected] = useState<Date>(initial);
  const [hours, setHours] = useState(() => {
    const [h] = (initialTime ?? "09:00").split(":");
    return Number(h) || 0;
  });
  const [minutes, setMinutes] = useState(() => {
    const [, m] = (initialTime ?? "09:00").split(":");
    return Number(m) || 0;
  });
  const [hoursDraft, setHoursDraft] = useState(() =>
    String(hours).padStart(2, "0"),
  );
  const [minutesDraft, setMinutesDraft] = useState(() =>
    String(minutes).padStart(2, "0"),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onCancel]);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  return (
    <div
      ref={rootRef}
      className="date-picker"
      role="dialog"
      aria-label="选择日期和时间"
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => {
          if (date) setSelected(date);
        }}
        defaultMonth={initial}
        startMonth={new Date(1900, 0, 1)}
        endMonth={new Date(2100, 11, 31)}
        weekStartsOn={weekStartsOn}
        showOutsideDays
        fixedWeeks
        captionLayout="dropdown"
        locale={zhCN}
        formatters={{
          formatCaption: (month) =>
            `${month.getFullYear()}年${month.getMonth() + 1}月`,
          formatWeekdayName: (weekday) =>
            "日一二三四五六"[weekday.getDay()],
          formatMonthDropdown: (month) => `${month.getMonth() + 1}月`,
          formatYearDropdown: (year) => `${year.getFullYear()}年`,
        }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === "left" ? (
              <ChevronUpIcon size={14} strokeWidth={1.5} />
            ) : (
              <ChevronDownIcon size={14} strokeWidth={1.5} />
            ),
          Dropdown: CalendarDropdown,
        }}
      />
      {withTime ? (
        <div className="date-picker-time">
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={hoursDraft}
            aria-label="小时"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
              setHoursDraft(raw);
              setHours(raw ? clamp(Number(raw), 0, 23) : 0);
            }}
            onBlur={() => setHoursDraft(String(hours).padStart(2, "0"))}
          />
          <span>:</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={minutesDraft}
            aria-label="分钟"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
              setMinutesDraft(raw);
              setMinutes(raw ? clamp(Number(raw), 0, 59) : 0);
            }}
            onBlur={() => setMinutesDraft(String(minutes).padStart(2, "0"))}
          />
        </div>
      ) : null}
      <div className="date-picker-actions">
        <button type="button" className="date-picker-btn" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="date-picker-btn primary"
          onClick={() =>
            onSave(
              dateToISO(selected),
              withTime
                ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
                : "",
            )
          }
        >
          保存
        </button>
      </div>
    </div>
  );
}
