import { apiFetch } from "./api";
import type { SharedFileType } from "../types";

export const CHUNK_SIZE = 1024 * 1024;
const DEFAULT_CONCURRENCY = 4;
const MAX_RETRIES = 3;

interface UploadStatusResponse {
  merged: boolean;
  received_chunks?: number[];
  filename?: string;
}

interface SendChunkParams {
  file: File;
  fileId: string;
  clientId?: string;
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  signal?: AbortSignal;
  retries?: number;
}

export interface UploadProgressEvent {
  fileId: string;
  uploadedBytes: number;
  totalBytes: number;
  progress: number;
  speedMbps: number;
  done: boolean;
}

interface UploadFileInChunksParams {
  file: File;
  clientId?: string;
  onProgress?: (event: UploadProgressEvent) => void;
  signal?: AbortSignal;
  concurrency?: number;
}

interface UploadFileInChunksResult {
  fileId: string;
  done: boolean;
  filename: string;
}

function makeFileId(file: File, clientId?: string): string {
  const owner = clientId || "unknown";
  return `${owner}__${file.name}__${file.size}__${file.lastModified}`;
}

function getChunkByteSize(file: File, chunkIndex: number): number {
  const chunkStart = chunkIndex * CHUNK_SIZE;
  const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
  return Math.max(0, chunkEnd - chunkStart);
}

async function requestUploadStatus(fileId: string, signal?: AbortSignal): Promise<UploadStatusResponse> {
  const response = await apiFetch(`/upload-status?file_id=${encodeURIComponent(fileId)}`, { signal });
  if (!response.ok) {
    return { merged: false, received_chunks: [] };
  }
  return (await response.json()) as UploadStatusResponse;
}

async function sendChunk({
  file,
  fileId,
  clientId,
  chunkIndex,
  totalChunks,
  filename,
  signal,
  retries = MAX_RETRIES,
}: SendChunkParams): Promise<unknown> {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunkBlob = file.slice(start, end);

  const formData = new FormData();
  formData.append("chunk", chunkBlob, `${filename}.part`);
  formData.append("file_id", fileId);
  formData.append("chunk_index", String(chunkIndex));
  formData.append("total_chunks", String(totalChunks));
  formData.append("filename", filename);
  if (clientId) {
    formData.append("client_id", clientId);
  }

  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    const response = await apiFetch("/upload-chunk", {
      method: "POST",
      body: formData,
      signal,
    });
    if (response.ok) {
      return response.json();
    }
    if (attempt >= retries) {
      const body = await response.text();
      throw new Error(body || "Chunk upload failed");
    }
  }
  throw new Error("Chunk upload failed");
}

export async function uploadFileInChunks({
  file,
  clientId,
  onProgress,
  signal,
  concurrency = DEFAULT_CONCURRENCY,
}: UploadFileInChunksParams): Promise<UploadFileInChunksResult> {
  const fileId = makeFileId(file, clientId);
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startedAt = performance.now();

  const status = await requestUploadStatus(fileId, signal);
  if (status.merged) {
    onProgress?.({
      fileId,
      uploadedBytes: file.size,
      totalBytes: file.size,
      progress: 100,
      speedMbps: 0,
      done: true,
    });
    return { fileId, done: true, filename: status.filename ?? file.name };
  }

  const received = new Set<number>(status.received_chunks ?? []);
  let uploadedBytes = 0;
  for (const index of received) {
    uploadedBytes += getChunkByteSize(file, index);
  }

  const pendingChunks: number[] = [];
  for (let i = 0; i < totalChunks; i += 1) {
    if (!received.has(i)) {
      pendingChunks.push(i);
    }
  }

  onProgress?.({
    fileId,
    uploadedBytes,
    totalBytes: file.size,
    progress: file.size > 0 ? Math.round((uploadedBytes / file.size) * 100) : 100,
    speedMbps: 0,
    done: uploadedBytes >= file.size,
  });

  if (pendingChunks.length === 0) {
    return { fileId, done: true, filename: file.name };
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, pendingChunks.length));

  const worker = async (): Promise<void> => {
    while (cursor < pendingChunks.length) {
      const current = cursor;
      cursor += 1;
      const chunkIndex = pendingChunks[current];
      await sendChunk({
        file,
        fileId,
        clientId,
        chunkIndex,
        totalChunks,
        filename: file.name,
        signal,
      });

      uploadedBytes += getChunkByteSize(file, chunkIndex);
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const speedMbps = (uploadedBytes * 8) / (elapsedSeconds * 1_000_000);
      onProgress?.({
        fileId,
        uploadedBytes,
        totalBytes: file.size,
        progress: Math.min(100, Math.round((uploadedBytes / file.size) * 100)),
        speedMbps,
        done: uploadedBytes >= file.size,
      });
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { fileId, done: true, filename: file.name };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function detectFileType(filename: string): SharedFileType {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) return "image";
  if (["pdf"].includes(extension)) return "pdf";
  if (["mp4", "mkv", "mov"].includes(extension)) return "video";
  return "other";
}

export function createFilePreview(file: File): string | null {
  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }
  return null;
}
