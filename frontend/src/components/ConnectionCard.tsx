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
      width: 220,
      margin: 1,
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

  return (
    <section className="card connection">
      <div>
        <h2>Connect From Phone</h2>
        <p className="muted">Open this URL on mobile (same Wi-Fi/hotspot):</p>
        <p className="url-line">{preferredFrontendUrl}</p>
        <p className="muted">Backend API:</p>
        {(localInfo?.urls ?? []).map((url) => (
          <p key={url} className="url-line small">
            {url}
          </p>
        ))}
      </div>
      {qrCodeDataUrl && <img className="qr-code" src={qrCodeDataUrl} alt="QR code for app URL" />}
    </section>
  );
}
