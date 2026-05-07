import { useEffect, useMemo, useState } from "react";
import ConnectionCard from "./components/ConnectionCard";
import FileDropzone from "./components/FileDropzone";
import FileList from "./components/FileList";
import ModeToggle from "./components/ModeToggle";
import UploadQueue from "./components/UploadQueue";
import { useChunkUpload } from "./hooks/useChunkUpload";
import type { LocalInfo, SharedFile, ThemeMode, TransferMode } from "./types";
import { apiFetch, getApiBase } from "./utils/api";
import { getDeviceId } from "./utils/deviceId";

export default function App() {
  const apiBase = useMemo(() => getApiBase(), []);
  const deviceId = useMemo(() => getDeviceId(), []);
  const [mode, setMode] = useState<TransferMode>("send");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");

  const {
    items,
    active,
    overallProgress,
    hasCompleted,
    addFiles,
    removeItem,
    clearFinished,
    startUpload,
  } = useChunkUpload(deviceId);

  const fetchFiles = async (silent = false): Promise<void> => {
    if (!silent) setRefreshing(true);
    try {
      const response = await apiFetch(
        `/files?viewer_id=${encodeURIComponent(deviceId)}`
      );
      if (response.ok) {
        const payload = (await response.json()) as { files?: SharedFile[] };
        setFiles(payload.files || []);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const fetchLocalInfo = async (): Promise<void> => {
    try {
      const response = await apiFetch("/local-info");
      if (response.ok) {
        setLocalInfo((await response.json()) as LocalInfo);
      }
    } catch {
      setLocalInfo(null);
    }
  };

  useEffect(() => {
    fetchLocalInfo();
  }, []);

  useEffect(() => {
    if (mode !== "receive") return undefined;

    fetchFiles();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFiles(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [mode, deviceId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleUploadStart = async (): Promise<void> => {
    await startUpload();
    await fetchFiles(true);
  };

  const handleDelete = async (filename: string): Promise<void> => {
    const confirmed = window.confirm(`Delete "${filename}"?`);
    if (!confirmed) return;
    const response = await apiFetch(`/files/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      fetchFiles(true);
    }
  };

  return (
    <main className="page hide-scrollbar">
      <header className="hero">
        <div>
          <h1>ShareIt Local Transfer</h1>
          <p>Fast image, PDF, and video sharing over local Wi-Fi or hotspot.</p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() =>
            setTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
        >
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
      </header>

      <ConnectionCard localInfo={localInfo} />
      <ModeToggle mode={mode} onChange={setMode} />

      {mode === "send" && (
        <>
          <FileDropzone onFiles={addFiles} />
          <UploadQueue
            items={items}
            active={active}
            overallProgress={overallProgress}
            onRemove={removeItem}
            onStart={handleUploadStart}
            onClearFinished={clearFinished}
          />
          {hasCompleted && !active && (
            <div className="status-banner">Transfer Complete</div>
          )}
        </>
      )}

      {mode === "receive" && (
        <FileList
          files={files}
          apiBase={apiBase}
          onDelete={handleDelete}
          refreshing={refreshing}
        />
      )}
    </main>
  );
}
