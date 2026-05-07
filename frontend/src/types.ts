export type TransferMode = "send" | "receive";
export type ThemeMode = "light" | "dark";
export type SharedFileType = "image" | "pdf" | "video" | "other";
export type UploadStatus = "pending" | "uploading" | "done" | "failed";

export interface SharedFile {
  name: string;
  size: number;
  type: SharedFileType;
}

export interface LocalInfo {
  preferred_ip?: string;
  local_ips?: string[];
  urls?: string[];
}

export interface UploadItem {
  id: string;
  file: File;
  type: SharedFileType;
  preview: string | null;
  progress: number;
  status: UploadStatus;
  speedMbps: number;
  error: string;
}
