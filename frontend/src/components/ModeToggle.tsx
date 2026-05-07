import type { TransferMode } from "../types";

interface ModeToggleProps {
  mode: TransferMode;
  onChange: (mode: TransferMode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="Transfer mode">
      <button
        type="button"
        className={mode === "send" ? "active" : ""}
        onClick={() => onChange("send")}
      >
        Send Files
      </button>
      <button
        type="button"
        className={mode === "receive" ? "active" : ""}
        onClick={() => onChange("receive")}
      >
        Receive Files
      </button>
    </div>
  );
}
