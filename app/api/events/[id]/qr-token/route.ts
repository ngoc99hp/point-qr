import { NextResponse } from "next/server";
import { getCurrentLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { signQrToken } from "@/lib/ticket";
import type { QrTokenResponse } from "@/lib/types/live";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET (AUTH): current rotating QR token for the OPEN round (SPEC §6.2, §9.1). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/events/[id]/qr-token">,
): Promise<NextResponse> {
  const lecturer = await getCurrentLecturer();
  if (!lecturer) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập." } },
      { status: 401, headers: NO_STORE },
    );
  }

  const { id } = await params;
  const event = await db.event.findFirst({
    where: { id, ownerId: lecturer.lecturerId },
    select: { rounds: { where: { status: "OPEN" }, take: 1, select: { id: true } } },
  });
  if (!event) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Không tìm thấy buổi đánh giá." } },
      { status: 404, headers: NO_STORE },
    );
  }

  const round = event.rounds[0];
  const body: QrTokenResponse = { token: round ? signQrToken(round.id, env.TICKET_SECRET, Date.now()) : null };
  return NextResponse.json(body, { headers: NO_STORE });
}
