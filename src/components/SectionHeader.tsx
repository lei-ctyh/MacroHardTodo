import { ChevronDownIcon, ChevronRightIcon } from "./icons";

export function SectionHeader({
  title,
  count,
  collapsed,
  onToggle,
}: {
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="section-title"
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      {collapsed ? (
        <ChevronRightIcon size={16} />
      ) : (
        <ChevronDownIcon size={16} />
      )}
      <span className="section-title-text">{title}</span>
      {count != null ? <span className="section-count">{count}</span> : null}
    </button>
  );
}
