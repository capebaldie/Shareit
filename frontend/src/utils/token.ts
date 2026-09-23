const TOKEN_STORAGE_KEY = "shareit_pairing_token";

function readFromUrl(): string | null {
  // The QR code carries the token in the hash, which browsers never put on the wire.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("t") || new URLSearchParams(window.location.search).get("t");
}

// Resolved once at module load, before React renders and before anything calls apiFetch.
// localStorage rather than sessionStorage: a phone backgrounding the tab mid-transfer and coming
// back must not have to rescan. A token from a previous server run is simply stale and 401s.
const token: string = (() => {
  const fromUrl = readFromUrl();
  try {
    if (fromUrl) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
      // keep it out of the address bar, where it would linger in history and in shared links
      window.history.replaceState(null, "", window.location.pathname);
      return fromUrl;
    }
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return fromUrl || "";
  }
})();

export function getToken(): string {
  return token;
}
