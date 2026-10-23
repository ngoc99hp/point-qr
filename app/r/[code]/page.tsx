import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { exchangeQrToken, getPublicCurrent, getPublicEventForm } from "@/lib/data/public";
import { scoreOptions } from "@/lib/score";
import { RatingForm } from "./rating-form";

export const metadata: Metadata = { title: "Chấm điểm · PeerScore" };

type SearchParams = Record<string, string | string[] | undefined>;

export default function RatePage({ params, searchParams }: PageProps<"/r/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted" />}>
        <Rate params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Rate({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  // Public page reads no cookies, so opt into request-time rendering explicitly
  // before touching the database or the clock (Cache Components).
  await connection();
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const token = Array.isArray(query.t) ? query.t[0] : query.t;
  const [event, current] = await Promise.all([getPublicEventForm(code), getPublicCurrent(code)]);
  if (!event || !current) notFound();
  // Rotating QR (§9.1): a fresh scanned token is exchanged for a 15-minute ticket.
  const entryTicket = event.rotatingQr ? await exchangeQrToken(code, token) : null;

  return (
    <RatingForm
      eventCode={event.code}
      eventTitle={event.title}
      scoreOptions={scoreOptions(event.scoreConfig)}
      initialCurrent={current}
      entryTicket={entryTicket}
    />
  );
}
