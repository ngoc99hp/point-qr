"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Renders the QR client-side (SPEC §3) as an SVG image inside a square frame.
 * An SVG <img> scales crisply and never distorts — the canvas renderer sets an
 * inline 1024px height that overrode our CSS and stretched the code.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [rendered, setRendered] = useState<{ value: string; src: string } | null>(null);
  const [failedValue, setFailedValue] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((svg) => {
        if (isCurrent) setRendered({ value, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
      })
      .catch(() => {
        if (isCurrent) setFailedValue(value);
      });
    return () => {
      isCurrent = false;
    };
  }, [value]);

  if (failedValue === value) {
    return <p className="text-destructive">Không tạo được mã QR. Hãy dùng đường dẫn bên dưới.</p>;
  }
  return (
    <div className="aspect-square w-full max-w-[min(62vh,100%)] rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5 md:p-6">
      {rendered ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimizable asset
        <img src={rendered.src} alt={label} className="size-full object-contain [image-rendering:pixelated]" />
      ) : (
        <div className="size-full animate-pulse rounded-2xl bg-neutral-100" aria-hidden />
      )}
    </div>
  );
}
