"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

const QR_RENDER_SIZE = 1024;

/** Renders the QR client-side onto a canvas (SPEC §3); CSS scales it. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, value, { width: QR_RENDER_SIZE, margin: 2, errorCorrectionLevel: "M" })
      .then(() => setHasError(false))
      .catch(() => setHasError(true));
  }, [value]);

  if (hasError) {
    return <p className="text-destructive">Không tạo được mã QR. Hãy dùng đường dẫn bên dưới.</p>;
  }
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="aspect-square h-auto w-full max-w-[min(70vh,100%)] rounded-xl bg-white"
    />
  );
}
