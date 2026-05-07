import type { SharedFile } from "../types";

interface PreviewPanelProps {
  file: SharedFile | null;
  apiBase: string;
  onClose: () => void;
}

export default function PreviewPanel({ file, apiBase, onClose }: PreviewPanelProps) {
  if (!file) return null;
  const source = `${apiBase}/preview/${encodeURIComponent(file.name)}`;

  return (
    <section className="preview-panel">
      <div className="preview-header">
        <h3>{file.name}</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="preview-content">
        {file.type === "image" && <img src={source} alt={file.name} />}
        {file.type === "pdf" && <iframe src={source} title={file.name} />}
        {file.type === "video" && (
          <video controls preload="metadata">
            <source src={source} />
          </video>
        )}
        {!["image", "pdf", "video"].includes(file.type) && (
          <p>Preview not supported for this file type.</p>
        )}
      </div>
      <div className="preview-footer">
        <a className="link-button" href={`${apiBase}/download/${encodeURIComponent(file.name)}`}>
          Download
        </a>
      </div>
    </section>
  );
}
