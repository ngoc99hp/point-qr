import { CalendarDays, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusPill } from "@/components/status-pill";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = { title: "Buổi đánh giá · PeerScore" };

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold md:text-5xl">
          Buổi <span className="text-brand-gradient">đánh giá</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Mỗi buổi có một mã QR riêng — sinh viên quét để chấm nhóm đang thuyết trình.
        </p>
      </div>
      <div className="rounded-3xl bg-brand-gradient p-[2px] shadow-lg shadow-primary/10">
        <div className="rounded-[calc(1.5rem-2px)] bg-card p-5 md:p-6">
          <CreateEventForm />
        </div>
      </div>
      <Suspense fallback={<div className="h-40 rounded-3xl bg-muted" />}>
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
      _count: { select: { groups: true, students: true } },
      rounds: { where: { status: "OPEN" }, select: { id: true }, take: 1 },
    },
  });

  if (events.length === 0) {
    return (
      <p className="rounded-3xl border-2 border-dashed p-10 text-center text-muted-foreground">
        Chưa có buổi đánh giá nào. Tạo buổi đầu tiên ở trên ✨
      </p>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {events.map((event) => {
        const isLive = event.rounds.length > 0;
        const isArchived = event.status === "ARCHIVED";
        return (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className={cn(
                "group relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border bg-card p-5 pl-7 shadow-sm transition-all",
                "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isArchived && "opacity-70",
              )}
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1.5", isLive ? "bg-coral" : isArchived ? "bg-muted-foreground/30" : "bg-brand-gradient")}
              />
              <div className="flex items-start justify-between gap-3">
                <span className="text-lg font-semibold leading-snug group-hover:text-primary">{event.title}</span>
                {isArchived ? (
                  <StatusPill tone="archived">Đã lưu trữ</StatusPill>
                ) : isLive ? (
                  <StatusPill tone="live">Đang chấm</StatusPill>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="rounded-lg bg-secondary px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-secondary-foreground">
                  {event.code}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users aria-hidden className="size-4" /> {event._count.groups} nhóm · {event._count.students} SV
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-4" /> {formatDateTime(event.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
