import { useRef, useState, type DragEvent } from "react";

interface FileDropzoneProps {
  onFiles: (files: FileList | null | undefined) => void;
}

export default function FileDropzone({ onFiles }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer?.files?.length) {
      onFiles(event.dataTransfer.files);
    }
  };

  return (
    <section
      className={`dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="File intake dropzone"
    >
      <span className="glyph" aria-hidden>↧</span>
      <p className="dropzone-title">
        {dragging ? "Release to load" : "Drop payload here"}
      </p>
      <p className="dropzone-subtitle">jpg · png · webp · pdf · mp4 · mkv · mov</p>
      <button
        type="button"
        className="btn"
        onClick={() => inputRef.current?.click()}
      >
        Pick Files
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mkv,.mov"
        multiple
        hidden
        onChange={(event) => onFiles(event.currentTarget.files)}
      />
    </section>
  );
}
