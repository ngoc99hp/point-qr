import { NextResponse } from "next/server";
import { getPublicCurrent } from "@/lib/data/public";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/public/events/[code]/current">,
): Promise<NextResponse> {
  const { code } = await params;
  const current = await getPublicCurrent(code);
  if (!current) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Không tìm thấy buổi đánh giá." } },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(current, { headers: NO_STORE });
}
