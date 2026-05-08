import { useCallback, useEffect, useMemo, useState } from "react";
import ConnectionCard from "./components/ConnectionCard";
import FileDropzone from "./components/FileDropzone";
import FileList from "./components/FileList";
import ModeToggle from "./components/ModeToggle";
import UploadQueue from "./components/UploadQueue";
import { useChunkUpload } from "./hooks/useChunkUpload";
import type { LocalInfo, SharedFile, ThemeMode, TransferMode } from "./types";
import { apiFetch, getApiBase } from "./utils/api";
import { getDeviceId } from "./utils/deviceId";

function formatClock(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

function shortNode(id: string): string {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "UNKNOWN";
}

function SectionHead({
  num,
  title,
  stamp,
}: {
  num: string;
  title: string;
  stamp?: string;
}) {
  return (
    <div className="section-head">
      <span className="num">§{num}</span>
      <span className="title">─ {title}</span>
      <span className="rule" />
      {stamp && <span className="stamp">{stamp}</span>}
    </div>
  );
}

export default function App() {
  const apiBase = useMemo(() => getApiBase(), []);
  const deviceId = useMemo(() => getDeviceId(), []);
  const [mode, setMode] = useState<TransferMode>("send");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [now, setNow] = useState<Date>(() => new Date());

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

  const fetchFiles = useCallback(
    async (silent = false): Promise<void> => {
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
    },
    [deviceId]
  );

  const fetchLocalInfo = useCallback(async (): Promise<void> => {
    try {
      const response = await apiFetch("/local-info");
      if (response.ok) {
        setLocalInfo((await response.json()) as LocalInfo);
      }
    } catch {
      setLocalInfo(null);
    }
  }, []);

  useEffect(() => {
    fetchLocalInfo();
  }, [fetchLocalInfo]);

  useEffect(() => {
    if (mode !== "receive") return undefined;
    fetchFiles();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFiles(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [mode, fetchFiles]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleUploadStart = useCallback(async (): Promise<void> => {
    await startUpload();
    await fetchFiles(true);
  }, [startUpload, fetchFiles]);

  const handleDelete = useCallback(
    async (filename: string): Promise<void> => {
      const confirmed = window.confirm(`DELETE "${filename}" — confirm?`);
      if (!confirmed) return;
      const response = await apiFetch(`/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchFiles(true);
      }
    },
    [fetchFiles]
  );

  const node = shortNode(deviceId);
  const linkOk = Boolean(localInfo?.preferred_ip || localInfo?.local_ips?.length);

  return (
    <main className="page">
      <header className="topbar">
        <div className="tb-left">
          <span className="dot" aria-hidden />
          <span>UPLINK · {linkOk ? "READY" : "PROBING"}</span>
        </div>
        <div className="tb-mid" aria-hidden>
          <div className="tb-ticker">
            <span>NODE <em>{node}</em></span>
            <span>PROTO <em>HTTP/CHUNK</em></span>
            <span>CIPHER <em>NONE · LAN</em></span>
            <span>QUEUE <em>{items.length.toString().padStart(2, "0")}</em></span>
            <span>RX <em>{files.length.toString().padStart(2, "0")}</em></span>
            <span>OVERALL <em>{overallProgress}%</em></span>
            <span>NODE <em>{node}</em></span>
            <span>PROTO <em>HTTP/CHUNK</em></span>
            <span>CIPHER <em>NONE · LAN</em></span>
            <span>QUEUE <em>{items.length.toString().padStart(2, "0")}</em></span>
            <span>RX <em>{files.length.toString().padStart(2, "0")}</em></span>
            <span>OVERALL <em>{overallProgress}%</em></span>
          </div>
        </div>
        <button
          type="button"
          className="tb-theme"
          onClick={() => setTheme((p) => (p === "light" ? "dark" : "light"))}
          aria-label="Toggle theme"
        >
          {theme === "light" ? "◐ DARK" : "◑ LIGHT"}
        </button>
      </header>

      <section className="hero">
        <div>
          <h1 className="wordmark">
            shareit<span className="blocks">▒▒▒</span>
          </h1>
          <p className="tag">
            LOCAL DISPATCH PROTOCOL · v1.0 · NODE {node}
            <span className="cursor" aria-hidden />
          </p>
        </div>
        <div className="hero-meta">
          <span><b>TIME</b> · {formatClock(now)}</span>
          <span><b>RANGE</b> · LAN / HOTSPOT</span>
          <span><b>CHANNEL</b> · {linkOk ? "OPEN" : "STANDBY"}</span>
        </div>
      </section>

      <SectionHead num="01" title="CONNECT" stamp="MANIFEST" />
      <ConnectionCard localInfo={localInfo} />

      <SectionHead
        num="02"
        title="MODE"
        stamp={mode === "send" ? "TX" : "RX"}
      />
      <ModeToggle mode={mode} onChange={setMode} />

      {mode === "send" && (
        <>
          <SectionHead num="03" title="INTAKE" stamp="DROP / PICK" />
          <FileDropzone onFiles={addFiles} />

          <SectionHead
            num="04"
            title="QUEUE"
            stamp={active ? "TRANSMITTING" : "READY"}
          />
          <UploadQueue
            items={items}
            active={active}
            overallProgress={overallProgress}
            onRemove={removeItem}
            onStart={handleUploadStart}
            onClearFinished={clearFinished}
          />
          {hasCompleted && !active && (
            <div className="status-banner" role="status">
              <span className="stamp-icon" aria-hidden>✓</span>
              <span>TRANSFER COMPLETE — PAYLOAD ACKNOWLEDGED</span>
              <span className="ts">{formatClock(now)}</span>
            </div>
          )}
        </>
      )}

      {mode === "receive" && (
        <>
          <SectionHead
            num="03"
            title="REGISTER"
            stamp={refreshing ? "POLLING" : "STABLE"}
          />
          <FileList
            files={files}
            apiBase={apiBase}
            onDelete={handleDelete}
            refreshing={refreshing}
          />
        </>
      )}

      <footer className="footer">
        <span>
          END OF SHEET · <em>SHAREIT // DISPATCH</em> · NODE {node}
        </span>
        <span>{formatClock(now)}</span>
      </footer>
    </main>
  );
}
