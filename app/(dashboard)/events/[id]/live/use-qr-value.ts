"use client";

import { useQuery } from "@tanstack/react-query";
import type { QrTokenResponse } from "@/lib/types/live";

/** Tokens are valid for 30–60 s (SPEC §9.1); refresh well inside that window. */
const QR_TOKEN_REFRESH_MS = 20_000;

async function fetchQrToken(eventId: string): Promise<QrTokenResponse> {
  const response = await fetch(`/api/events/${eventId}/qr-token`, { cache: "no-store" });
  if (!response.ok) throw new Error(`qr-token ${response.status}`);
  return (await response.json()) as QrTokenResponse;
}

/**
 * The URL to encode in the projector QR. Static QR: the plain student URL.
 * Rotating QR with an open round: student URL + `?t=<token>`, refreshed every 20 s;
 * null while the first token is loading (never show a token-less QR then).
 */
export function useQrValue(input: {
  eventId: string;
  studentUrl: string;
  rotatingQr: boolean;
  openRoundId: string | null;
}): string | null {
  const isRotatingOpen = input.rotatingQr && input.openRoundId !== null;
  const { data } = useQuery({
    queryKey: ["qr-token", input.eventId, input.openRoundId],
    queryFn: () => fetchQrToken(input.eventId),
    enabled: isRotatingOpen,
    refetchInterval: QR_TOKEN_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  if (!isRotatingOpen) return input.studentUrl;
  if (!data?.token) return null;
  const url = new URL(input.studentUrl);
  url.searchParams.set("t", data.token);
  return url.toString();
}
