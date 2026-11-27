export function ToggleSwitch({
  checked,
  ariaLabel,
  onChange,
  showText = true,
}: {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
  showText?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`toggle-switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
      {showText ? (
        <span className="toggle-text">{checked ? "开" : "关"}</span>
      ) : null}
    </button>
  );
}
