import { formatBytes } from "../utils/chunkUpload";
import type { SharedFileType, UploadItem, UploadStatus } from "../types";

interface UploadQueueProps {
  items: UploadItem[];
  active: boolean;
  overallProgress: number;
  onRemove: (id: string) => void;
  onStart: () => void | Promise<void>;
  onClearFinished: () => void;
}

function typeLabel(type: SharedFileType): string {
  if (type === "image") return "IMG";
  if (type === "pdf") return "PDF";
  if (type === "video") return "VID";
  return "FILE";
}

function statusLabel(s: UploadStatus): string {
  if (s === "pending") return "QUEUED";
  if (s === "uploading") return "TX ▶";
  if (s === "done") return "OK";
  if (s === "failed") return "ERR";
  return s;
}

const BAR_WIDTH = 28;

function AsciiBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, progress));
  const filled = Math.round((pct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return (
    <div className="ascii-bar" aria-hidden>
      <span>[</span>
      <span className="filled">{"█".repeat(filled)}</span>
      <span className="empty">{"░".repeat(empty)}</span>
      <span>]</span>
    </div>
  );
}

export default function UploadQueue({
  items,
  active,
  overallProgress,
  onRemove,
  onStart,
  onClearFinished,
}: UploadQueueProps) {
  return (
    <section className="box no-pad shadow" aria-label="Upload queue">
      <div className="queue-head">
        <h2>Upload Queue</h2>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={onStart}
            disabled={!items.length || active}
          >
            {active ? "Transmitting…" : "Start Transfer"}
          </button>
          <button type="button" className="btn ghost" onClick={onClearFinished}>
            Clear Done
          </button>
        </div>
      </div>

      <div className="queue-overall">
        <div className="meta">
          <span className="num">{overallProgress.toString().padStart(3, "0")}%</span>
          <AsciiBar progress={overallProgress} />
          <span className="label">
            {items.length === 0
              ? "no payload"
              : `${items.filter((i) => i.status === "done").length} of ${items.length} delivered`}
          </span>
        </div>
      </div>

      {!items.length && (
        <p className="queue-empty">No payload selected. Drop or pick files above.</p>
      )}

      <div className="queue-list">
        {items.map((item, idx) => (
          <article key={item.id} className="queue-row">
            <span className="idx">{(idx + 1).toString().padStart(2, "0")}</span>

            <div className="preview" aria-hidden>
              {item.preview ? (
                <img src={item.preview} alt="" />
              ) : (
                <span className="type-pill">{typeLabel(item.type)}</span>
              )}
            </div>

            <div className="body">
              <p className="name" title={item.file.name}>
                {item.file.name}
              </p>
              <div className="meta">
                <span>{formatBytes(item.file.size)}</span>
                <span className="sep">·</span>
                <span>{typeLabel(item.type)}</span>
                {item.speedMbps > 0 && (
                  <>
                    <span className="sep">·</span>
                    <span>{item.speedMbps.toFixed(2)} Mbps</span>
                  </>
                )}
              </div>
              <div className="row-progress">
                <AsciiBar progress={item.progress} />
                <span className={`pct ${item.status}`}>
                  {item.progress.toString().padStart(3, "0")}%
                </span>
              </div>
              {item.error && <p className="err">ERR · {item.error}</p>}
            </div>

            <div className="right">
              <span className={`status-tag ${item.status}`}>
                {statusLabel(item.status)}
              </span>
              <button
                type="button"
                className="icon-x"
                onClick={() => onRemove(item.id)}
                aria-label={item.status === "uploading" ? "Cancel" : "Remove"}
              >
                {item.status === "uploading" ? "× cancel" : "× remove"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
