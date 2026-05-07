import { formatBytes } from "../utils/chunkUpload";
import type { SharedFileType, UploadItem } from "../types";

interface UploadQueueProps {
  items: UploadItem[];
  active: boolean;
  overallProgress: number;
  onRemove: (id: string) => void;
  onStart: () => void | Promise<void>;
  onClearFinished: () => void;
}

function typeLabel(type: SharedFileType): string {
  if (type === "image") return "Image";
  if (type === "pdf") return "PDF";
  if (type === "video") return "Video";
  return "File";
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
    <section className="card">
      <div className="card-header">
        <h2>Upload Queue</h2>
        <div className="actions-row">
          <button
            type="button"
            className="primary"
            onClick={onStart}
            disabled={!items.length || active}
          >
            {active ? "Uploading..." : "Start Transfer"}
          </button>
          <button type="button" onClick={onClearFinished}>
            Clear Completed
          </button>
        </div>
      </div>
      <div className="overall-progress">
        <div className="progress-meta">
          <span>Overall</span>
          <span>{overallProgress}%</span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${overallProgress}%` }} />
        </div>
      </div>
      {!items.length && <p className="muted">No files selected yet.</p>}
      <div className="upload-list">
        {items.map((item) => (
          <article key={item.id} className="upload-item">
            <div className="upload-preview">
              {item.preview ? (
                <img src={item.preview} alt={item.file.name} />
              ) : (
                <span className="type-pill">{typeLabel(item.type)}</span>
              )}
            </div>
            <div className="upload-main">
              <p className="file-name" title={item.file.name}>
                {item.file.name}
              </p>
              <p className="file-meta">
                {formatBytes(item.file.size)} • {typeLabel(item.type)}
              </p>
              <div className="progress-meta">
                <span className={`status ${item.status}`}>{item.status}</span>
                <span>{item.progress}%</span>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${item.progress}%` }} />
              </div>
              {item.speedMbps > 0 && (
                <p className="file-meta">Speed: {item.speedMbps.toFixed(2)} Mbps</p>
              )}
              {item.error && <p className="error">{item.error}</p>}
            </div>
            <button
              type="button"
              className="danger-text"
              onClick={() => onRemove(item.id)}
              disabled={item.status === "uploading"}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
