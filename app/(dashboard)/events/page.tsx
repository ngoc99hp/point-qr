import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Buổi đánh giá · PeerScore" };

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Buổi đánh giá</h1>
        <p className="text-muted-foreground">
          Mỗi buổi có một mã QR riêng; sinh viên quét để chấm nhóm đang thuyết trình.
        </p>
      </div>
      <Card>
        <CardContent>
          <CreateEventForm />
        </CardContent>
      </Card>
      <Suspense fallback={<div className="h-40 rounded-xl bg-muted" />}>
        <EventList />
      </Suspense>
    </div>
  );
}

async function EventList() {
  const { lecturerId } = await requireLecturer();
  const events = await db.event.findMany({
    where: { ownerId: lecturerId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      createdAt: true,
      _count: { select: { groups: true } },
      rounds: { where: { status: "OPEN" }, select: { id: true }, take: 1 },
    },
  });

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        Chưa có buổi đánh giá nào. Tạo buổi đầu tiên ở trên.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/events/${event.id}`}
            className="flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium leading-snug">{event.title}</span>
              {event.status === "ARCHIVED" ? (
                <Badge variant="secondary">Đã lưu trữ</Badge>
              ) : event.rounds.length > 0 ? (
                <Badge>Đang chấm</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                Mã <span className="font-mono font-semibold text-foreground">{event.code}</span>
              </span>
              <span>{event._count.groups} nhóm</span>
              <span>Tạo {formatDateTime(event.createdAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
