import { useEffect, useMemo, useState } from "react";
import * as QRCode from "qrcode";
import type { LocalInfo } from "../types";

interface ConnectionCardProps {
  localInfo: LocalInfo | null;
}

function buildFrontendUrl(localIp: string): string {
  const protocol = window.location.protocol;
  const port = window.location.port || "5173";
  return `${protocol}//${localIp}:${port}`;
}

export default function ConnectionCard({ localInfo }: ConnectionCardProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const preferredFrontendUrl = useMemo(() => {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return window.location.origin;
    }
    const preferredIp = localInfo?.preferred_ip || localInfo?.local_ips?.[0];
    if (preferredIp) {
      return buildFrontendUrl(preferredIp);
    }
    return window.location.origin;
  }, [localInfo]);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(preferredFrontendUrl, {
      errorCorrectionLevel: "M",
      width: 320,
      margin: 0,
      color: { dark: "#0c0c0a", light: "#00000000" },
    })
      .then((url) => {
        if (mounted) setQrCodeDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrCodeDataUrl("");
      });
    return () => {
      mounted = false;
    };
  }, [preferredFrontendUrl]);

  const apiUrls = localInfo?.urls ?? [];

  return (
    <section className="box bracketed shadow manifest" aria-label="Connection manifest">
      <div className="manifest-rows">
        <h2>Connect From Phone</h2>

        <div className="field">
          <span className="field-key">Frontend URL</span>
          <span className="field-val primary">
            <span className="arrow">▸</span>
            {preferredFrontendUrl}
          </span>
        </div>

        <div className="field">
          <span className="field-key">Backend API</span>
          <span className="field-val">
            {apiUrls.length === 0 ? (
              <span style={{ color: "var(--mute)" }}>// probing routes…</span>
            ) : (
              <div className="url-list">
                {apiUrls.map((url, i) => (
                  <div key={url} className="url-row">
                    <span className="idx">{(i + 1).toString().padStart(2, "0")}</span>
                    <span>{url}</span>
                  </div>
                ))}
              </div>
            )}
          </span>
        </div>

        <div className="field">
          <span className="field-key">Pairing</span>
          <span className="field-val" style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Same Wi-Fi or hotspot. Scan the code, or punch in the URL.
          </span>
        </div>
      </div>

      <div className="qr-frame">
        <div className="qr-wrap">
          {qrCodeDataUrl ? (
            <img className="qr-code" src={qrCodeDataUrl} alt="QR code for app URL" />
          ) : (
            <div className="qr-code" style={{ display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--mute)" }}>GENERATING…</span>
            </div>
          )}
        </div>
        <span className="qr-cap">POINT · DEVICE · CAMERA</span>
      </div>
    </section>
  );
}
