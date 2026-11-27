import { useStore } from "../store/useStore";
import { Modal } from "./Modal";

export function ConfirmDialog() {
  const confirm = useStore((s) => s.confirm);
  const closeConfirm = useStore((s) => s.closeConfirm);

  if (!confirm) return null;

  const proceed = () => {
    const action = confirm.onConfirm;
    closeConfirm();
    action();
  };

  return (
    <Modal
      title={confirm.title}
      narrow
      onClose={closeConfirm}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeConfirm}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${confirm.danger ? "danger-solid" : "primary"}`}
            onClick={proceed}
            autoFocus
          >
            {confirm.confirmLabel ?? "删除"}
          </button>
        </>
      }
    >
      <p className="confirm-message">{confirm.message}</p>
    </Modal>
  );
}
