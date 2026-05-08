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
        role="tab"
        aria-selected={mode === "send"}
        className={mode === "send" ? "active" : ""}
        onClick={() => onChange("send")}
      >
        <span className="checkbox" aria-hidden>
          {mode === "send" ? "✕" : ""}
        </span>
        <span>Send · TX</span>
        <span className="arrow" aria-hidden>↗</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "receive"}
        className={mode === "receive" ? "active" : ""}
        onClick={() => onChange("receive")}
      >
        <span className="checkbox" aria-hidden>
          {mode === "receive" ? "✕" : ""}
        </span>
        <span>Receive · RX</span>
        <span className="arrow" aria-hidden>↙</span>
      </button>
    </div>
  );
}
