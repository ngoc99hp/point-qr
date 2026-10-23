import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireLecturer } from "@/lib/auth";
import { findOwnedEvent } from "@/lib/data/ownership";
import { env } from "@/lib/env";
import { LiveScreen } from "./live-screen";

export const metadata: Metadata = { title: "Màn chiếu · PeerScore" };

export default function LivePage({ params }: PageProps<"/events/[id]/live">) {
  return (
    <Suspense fallback={<div className="h-[70vh] rounded-xl bg-muted" />}>
      <Live params={params} />
    </Suspense>
  );
}

async function Live({ params }: { params: Promise<{ id: string }> }) {
  const [{ lecturerId }, { id }] = await Promise.all([requireLecturer(), params]);
  const event = await findOwnedEvent(lecturerId, id);
  if (!event) notFound();

  const studentUrl = new URL(`/r/${event.code}`, env.NEXT_PUBLIC_APP_URL).toString();
  return <LiveScreen eventId={event.id} studentUrl={studentUrl} />;
}
