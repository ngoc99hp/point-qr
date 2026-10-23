import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPublicCurrent, getPublicEventForm } from "@/lib/data/public";
import { scoreOptions } from "@/lib/score";
import { RatingForm } from "./rating-form";

export const metadata: Metadata = { title: "Chấm điểm · PeerScore" };

export default function RatePage({ params }: PageProps<"/r/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Suspense fallback={<div className="h-96 rounded-xl bg-muted" />}>
        <Rate params={params} />
      </Suspense>
    </main>
  );
}

async function Rate({ params }: { params: Promise<{ code: string }> }) {
  // Public page reads no cookies, so opt into request-time rendering explicitly
  // before touching the database (Cache Components).
  await connection();
  const { code } = await params;
  const [event, current] = await Promise.all([getPublicEventForm(code), getPublicCurrent(code)]);
  if (!event || !current) notFound();

  return (
    <RatingForm
      eventCode={event.code}
      eventTitle={event.title}
      scoreOptions={scoreOptions(event.scoreConfig)}
      initialCurrent={current}
    />
  );
}
