import { formatBytes } from "../utils/chunkUpload";
import type { SharedFile, SharedFileType } from "../types";

interface FileListProps {
  files: SharedFile[];
  apiBase: string;
  onDelete: (filename: string) => void | Promise<void>;
  refreshing: boolean;
}

function typeLabel(type: SharedFileType): string {
  if (type === "image") return "Image";
  if (type === "pdf") return "PDF";
  if (type === "video") return "Video";
  return "File";
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v5h5M9 13h6M9 17h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FileList({
  files,
  apiBase,
  onDelete,
  refreshing,
}: FileListProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Available Files</h2>
        <p className="muted">{refreshing ? "Refreshing..." : `${files.length} file(s)`}</p>
      </div>
      {!files.length && <p className="muted">No shared files yet.</p>}
      <div className="file-grid">
        {files.map((file) => (
          <article key={file.name} className="file-card">
            <div className="file-icon-wrap">
              <FileIcon />
            </div>
            <div className="file-body">
              <p className="file-name" title={file.name}>
                {file.name}
              </p>
              <p className="file-meta">
                {formatBytes(file.size)} • {typeLabel(file.type)}
              </p>
            </div>
            <div className="file-actions">
              <a
                className="link-button"
                href={`${apiBase}/download/${encodeURIComponent(file.name)}`}
              >
                Save
              </a>
              <button type="button" onClick={() => onDelete(file.name)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
