import { NextResponse } from "next/server";
import { getCurrentLecturer } from "@/lib/auth";
import { getLiveSnapshot } from "@/lib/data/live";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/events/[id]/live">,
): Promise<NextResponse> {
  const lecturer = await getCurrentLecturer();
  if (!lecturer) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Chưa đăng nhập." } },
      { status: 401, headers: NO_STORE },
    );
  }

  const { id } = await params;
  const snapshot = await getLiveSnapshot(lecturer.lecturerId, id);
  if (!snapshot) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Không tìm thấy buổi đánh giá." } },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(snapshot, { headers: NO_STORE });
}
