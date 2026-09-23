import { getToken } from "./token";

export function getApiBase(): string {
  const explicitBase = import.meta.env.VITE_API_BASE;
  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) {
    headers.set("X-ShareIt-Token", token);
  }
  // Content-Type is deliberately never set here: FormData needs to pick its own multipart boundary.
  return fetch(`${base}${path}`, { ...options, headers });
}

/** For URLs the browser fetches on its own -- <a href>, <img src> -- which cannot carry a header. */
export function withToken(url: string): string {
  const token = getToken();
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}`;
}
