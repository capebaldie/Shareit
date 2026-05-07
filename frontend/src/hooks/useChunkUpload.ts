import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type UploadProgressEvent,
  createFilePreview,
  detectFileType,
  uploadFileInChunks,
} from "../utils/chunkUpload";
import type { UploadItem } from "../types";

interface ChunkUploadHookResult {
  items: UploadItem[];
  active: boolean;
  overallProgress: number;
  hasCompleted: boolean;
  addFiles: (fileList: FileList | null | undefined) => void;
  removeItem: (id: string) => void;
  clearFinished: () => void;
  startUpload: () => Promise<void>;
}

function createUploadItem(file: File): UploadItem {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  return {
    id,
    file,
    type: detectFileType(file.name),
    preview: createFilePreview(file),
    progress: 0,
    status: "pending",
    speedMbps: 0,
    error: "",
  };
}

export function useChunkUpload(clientId: string): ChunkUploadHookResult {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [active, setActive] = useState(false);
  const itemsRef = useRef<UploadItem[]>(items);
  const activeRef = useRef<boolean>(active);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const addFiles = (fileList: FileList | null | undefined): void => {
    const incoming = Array.from(fileList ?? []).map(createUploadItem);
    if (!incoming.length) return;
    setItems((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const merged = [...prev];
      for (const next of incoming) {
        if (!existing.has(next.id)) merged.push(next);
      }
      return merged;
    });
  };

  const removeItem = (id: string): void => {
    setItems((prev) => {
      const found = prev.find((item) => item.id === id);
      if (found?.preview) {
        URL.revokeObjectURL(found.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearFinished = (): void => {
    setItems((prev) => {
      for (const item of prev) {
        if (item.status === "done" && item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      }
      return prev.filter((item) => item.status !== "done");
    });
  };

  const startUpload = useCallback(async (): Promise<void> => {
    if (activeRef.current) return;
    setActive(true);
    try {
      const queue = [...itemsRef.current];
      for (const item of queue) {
        if (!["pending", "failed"].includes(item.status)) continue;

        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "uploading", error: "", speedMbps: 0 }
              : entry
          )
        );

        try {
          await uploadFileInChunks({
            file: item.file,
            clientId,
            concurrency: 4,
            onProgress: ({ progress, speedMbps, done }: UploadProgressEvent) => {
              setItems((prev) =>
                prev.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        progress,
                        speedMbps: Number.isFinite(speedMbps) ? speedMbps : 0,
                        status: done ? "done" : "uploading",
                      }
                    : entry
                )
              );
            },
          });
        } catch (error) {
          setItems((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: "failed",
                    error: error instanceof Error ? error.message : "Upload failed",
                  }
                : entry
            )
          );
        }
      }
    } finally {
      setActive(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (active) return;
    const hasPending = items.some((item) => item.status === "pending");
    if (!hasPending) return;
    const timeout = setTimeout(() => {
      startUpload();
    }, 0);
    return () => clearTimeout(timeout);
  }, [items, active, startUpload]);

  const overallProgress = useMemo(() => {
    if (!items.length) return 0;
    const totalSize = items.reduce((acc, item) => acc + item.file.size, 0);
    if (!totalSize) return 0;
    const uploaded = items.reduce(
      (acc, item) => acc + (item.file.size * item.progress) / 100,
      0
    );
    return Math.round((uploaded / totalSize) * 100);
  }, [items]);

  const hasCompleted = items.some((item) => item.status === "done");

  return {
    items,
    active,
    overallProgress,
    hasCompleted,
    addFiles,
    removeItem,
    clearFinished,
    startUpload,
  };
}
