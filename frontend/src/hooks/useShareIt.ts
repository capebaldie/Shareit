import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalInfo, SharedFile, TransferMode } from "../types";
import { apiFetch, getApiBase } from "../utils/api";
import { getDeviceId } from "../utils/deviceId";
import { useChunkUpload } from "./useChunkUpload";

export function useShareIt() {
  const apiBase = useMemo(() => getApiBase(), []);
  const deviceId = useMemo(() => getDeviceId(), []);
  const [mode, setMode] = useState<TransferMode>("send");
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const queue = useChunkUpload(deviceId);

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
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleUploadStart = useCallback(async (): Promise<void> => {
    await queue.startUpload();
    await fetchFiles(true);
  }, [queue, fetchFiles]);

  const handleDelete = useCallback(
    async (filename: string): Promise<void> => {
      const confirmed = window.confirm(`Delete "${filename}"?`);
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

  return {
    apiBase,
    deviceId,
    mode,
    setMode,
    files,
    refreshing,
    localInfo,
    now,
    items: queue.items,
    active: queue.active,
    overallProgress: queue.overallProgress,
    hasCompleted: queue.hasCompleted,
    addFiles: queue.addFiles,
    removeItem: queue.removeItem,
    clearFinished: queue.clearFinished,
    handleUploadStart,
    handleDelete,
  };
}

export type ShareItState = ReturnType<typeof useShareIt>;
