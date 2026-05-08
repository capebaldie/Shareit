import { formatBytes } from "../utils/chunkUpload";
import type { SharedFile, SharedFileType } from "../types";

interface FileListProps {
  files: SharedFile[];
  apiBase: string;
  onDelete: (filename: string) => void | Promise<void>;
  refreshing: boolean;
}

function typeLabel(type: SharedFileType): string {
  if (type === "image") return "IMG";
  if (type === "pdf") return "PDF";
  if (type === "video") return "VID";
  return "FILE";
}

export default function FileList({
  files,
  apiBase,
  onDelete,
  refreshing,
}: FileListProps) {
  return (
    <section className="box no-pad shadow" aria-label="Available files register">
      <div className="register-head">
        <h2>Available Files</h2>
        <p className="count">
          <em>{files.length.toString().padStart(2, "0")}</em>
          {refreshing ? "polling…" : files.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      {!files.length ? (
        <p className="register-empty">
          <span className="glyph" aria-hidden>∅</span>
          No shared files yet. Standing by for incoming.
        </p>
      ) : (
        <>
          <div className="register-grid-head" aria-hidden>
            <span>#</span>
            <span>Filename</span>
            <span>Size</span>
            <span>Type</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {files.map((file, idx) => (
            <article key={file.name} className="register-row">
              <span className="idx">{(idx + 1).toString().padStart(2, "0")}</span>
              <span className="name" title={file.name}>{file.name}</span>
              <span className="size">{formatBytes(file.size)}</span>
              <span className="ttype">{typeLabel(file.type)}</span>
              <span className="actions">
                <a
                  className="btn tiny no-arrow"
                  href={`${apiBase}/download/${encodeURIComponent(file.name)}`}
                >
                  ↧ Save
                </a>
                <button
                  type="button"
                  className="btn tiny no-arrow ghost"
                  onClick={() => onDelete(file.name)}
                >
                  ✕ Delete
                </button>
              </span>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
