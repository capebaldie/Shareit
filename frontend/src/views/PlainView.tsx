import { useEffect, useMemo, useState } from "react";
import * as QRCode from "qrcode";
import { formatBytes } from "../utils/chunkUpload";
import type {
  LocalInfo,
  SharedFile,
  SharedFileType,
  TransferMode,
  UploadItem,
  UploadStatus,
} from "../types";
import type { ViewProps } from "./types";

function typeLabel(t: SharedFileType): string {
  if (t === "image") return "Image";
  if (t === "pdf") return "PDF";
  if (t === "video") return "Video";
  return "File";
}

function statusLabel(s: UploadStatus): string {
  if (s === "pending") return "queued";
  return s;
}

function buildFrontendUrl(localIp: string): string {
  const protocol = window.location.protocol;
  const port = window.location.port || "5173";
  return `${protocol}//${localIp}:${port}`;
}

function PlainConnection({ localInfo }: { localInfo: LocalInfo | null }) {
  const [qr, setQr] = useState("");

  const url = useMemo(() => {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return window.location.origin;
    }
    const ip = localInfo?.preferred_ip || localInfo?.local_ips?.[0];
    return ip ? buildFrontendUrl(ip) : window.location.origin;
  }, [localInfo]);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 240, margin: 1 })
      .then((d) => mounted && setQr(d))
      .catch(() => mounted && setQr(""));
    return () => {
      mounted = false;
    };
  }, [url]);

  return (
    <section className="plain-card">
      <div className="plain-card-head">
        <h2>Connect from phone</h2>
        <span className="meta">Same Wi-Fi or hotspot</span>
      </div>
      <div className="plain-connection">
        <div>
          <div className="url">{url}</div>
          <div className="hint">Open this URL on your phone, or scan the QR code.</div>
        </div>
        {qr && <img className="qr" src={qr} alt="QR code" />}
      </div>
    </section>
  );
}

function PlainModeToggle({
  mode,
  onChange,
}: {
  mode: TransferMode;
  onChange: (m: TransferMode) => void;
}) {
  return (
    <div className="plain-segmented" role="tablist" aria-label="Transfer mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "send"}
        className={mode === "send" ? "active" : ""}
        onClick={() => onChange("send")}
      >
        Send
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "receive"}
        className={mode === "receive" ? "active" : ""}
        onClick={() => onChange("receive")}
      >
        Receive
      </button>
    </div>
  );
}

function PlainDropzone({
  onFiles,
}: {
  onFiles: (f: FileList | null | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = "plain-file-input";

  return (
    <section
      className={`plain-dropzone${dragging ? " dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <p className="title">{dragging ? "Release to add" : "Drop files here"}</p>
      <p className="sub">Images, PDFs, MP4 / MKV / MOV</p>
      <label htmlFor={inputId} className="plain-btn" style={{ cursor: "pointer" }}>
        Choose files
      </label>
      <input
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mkv,.mov"
        multiple
        hidden
        onChange={(e) => onFiles(e.currentTarget.files)}
      />
    </section>
  );
}

function PlainQueue({
  items,
  active,
  overallProgress,
  onRemove,
  onStart,
  onClearFinished,
}: {
  items: UploadItem[];
  active: boolean;
  overallProgress: number;
  onRemove: (id: string) => void;
  onStart: () => void | Promise<void>;
  onClearFinished: () => void;
}) {
  const done = items.filter((i) => i.status === "done").length;

  return (
    <section className="plain-card">
      <div className="plain-card-head">
        <h2>Upload queue</h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="plain-btn primary"
            onClick={onStart}
            disabled={!items.length || active}
          >
            {active ? "Uploading…" : "Start transfer"}
          </button>
          <button
            type="button"
            className="plain-btn ghost"
            onClick={onClearFinished}
          >
            Clear done
          </button>
        </div>
      </div>

      <div className="plain-overall">
        <div className="meta">
          <span>
            {items.length === 0
              ? "No files selected"
              : `${done} of ${items.length} done`}
          </span>
          <span>{overallProgress}%</span>
        </div>
        <div className="plain-progress">
          <span style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      {!items.length ? (
        <p className="plain-empty">Drop or pick files to add them here.</p>
      ) : (
        <div className="plain-list">
          {items.map((item) => (
            <article key={item.id} className="plain-row">
              <div style={{ minWidth: 0 }}>
                <p className="name" title={item.file.name}>
                  {item.file.name}
                </p>
                <p className="meta">
                  <span>{formatBytes(item.file.size)}</span>
                  <span className="sep">·</span>
                  <span>{typeLabel(item.type)}</span>
                  {item.speedMbps > 0 && (
                    <>
                      <span className="sep">·</span>
                      <span>{item.speedMbps.toFixed(2)} Mbps</span>
                    </>
                  )}
                </p>
              </div>
              <div className="right">
                <span className={`status ${item.status}`}>{statusLabel(item.status)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemove(item.id)}
                  aria-label={item.status === "uploading" ? "Cancel" : "Remove"}
                  title={item.status === "uploading" ? "Cancel" : "Remove"}
                >
                  ×
                </button>
              </div>
              <div className="progress-block">
                <div className="meta">
                  <span style={{ visibility: "hidden" }}>·</span>
                  <span className="pct">{item.progress}%</span>
                </div>
                <div
                  className={`plain-progress${
                    item.status === "done"
                      ? " done"
                      : item.status === "failed"
                      ? " failed"
                      : ""
                  }`}
                >
                  <span style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              {item.error && <div className="err">Error: {item.error}</div>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PlainFiles({
  files,
  apiBase,
  onDelete,
  refreshing,
}: {
  files: SharedFile[];
  apiBase: string;
  onDelete: (name: string) => void | Promise<void>;
  refreshing: boolean;
}) {
  return (
    <section className="plain-card">
      <div className="plain-card-head">
        <h2>Available files</h2>
        <span className="meta">
          {refreshing ? "Refreshing…" : `${files.length} ${files.length === 1 ? "file" : "files"}`}
        </span>
      </div>
      {!files.length ? (
        <p className="plain-empty">No shared files yet.</p>
      ) : (
        <div className="plain-files">
          {files.map((file) => (
            <div key={file.name} className="plain-file">
              <div style={{ minWidth: 0 }}>
                <p className="name" title={file.name}>
                  {file.name}
                </p>
                <p className="meta">
                  {formatBytes(file.size)} · {typeLabel(file.type)}
                </p>
              </div>
              <div className="actions">
                <a
                  className="plain-btn sm"
                  href={`${apiBase}/download/${encodeURIComponent(file.name)}`}
                >
                  Download
                </a>
                <button
                  type="button"
                  className="plain-btn sm danger"
                  onClick={() => onDelete(file.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PlainView({
  apiBase,
  mode,
  setMode,
  files,
  refreshing,
  localInfo,
  items,
  active,
  overallProgress,
  hasCompleted,
  addFiles,
  removeItem,
  clearFinished,
  handleUploadStart,
  handleDelete,
  theme,
  onToggleTheme,
  onToggleDesign,
}: ViewProps) {
  return (
    <main className="plain">
      <header className="plain-header">
        <div className="plain-title">
          <h1>ShareIt</h1>
          <small>Local file transfer</small>
        </div>
        <div className="plain-toolbar">
          <button
            type="button"
            className="plain-btn sm"
            onClick={onToggleDesign}
            title="Switch to dispatch design"
          >
            ◇ Dispatch
          </button>
          <button
            type="button"
            className="plain-btn sm"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <PlainConnection localInfo={localInfo} />
      <PlainModeToggle mode={mode} onChange={setMode} />

      {mode === "send" && (
        <>
          <PlainDropzone onFiles={addFiles} />
          <PlainQueue
            items={items}
            active={active}
            overallProgress={overallProgress}
            onRemove={removeItem}
            onStart={handleUploadStart}
            onClearFinished={clearFinished}
          />
          {hasCompleted && !active && (
            <div className="plain-banner" role="status">
              <span aria-hidden>✓</span>
              <span>Transfer complete.</span>
            </div>
          )}
        </>
      )}

      {mode === "receive" && (
        <PlainFiles
          files={files}
          apiBase={apiBase}
          onDelete={handleDelete}
          refreshing={refreshing}
        />
      )}

      <footer className="plain-footer">ShareIt · local network only</footer>
    </main>
  );
}
