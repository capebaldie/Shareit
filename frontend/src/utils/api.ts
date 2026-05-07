export function getApiBase(): string {
  const explicitBase = import.meta.env.VITE_API_BASE;
  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, options);
  return response;
}
