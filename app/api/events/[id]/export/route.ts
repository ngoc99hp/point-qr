import { NextResponse, type NextRequest } from "next/server";
import { getCurrentLecturer } from "@/lib/auth";
import { getEventResults } from "@/lib/data/results";
import { rawCsv, summaryCsv } from "@/lib/export-csv";

const NO_STORE = { "Cache-Control": "no-store" };

function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers: NO_STORE });
}

/** GET ?type=summary|raw → UTF-8 CSV with BOM (SPEC §6.3). */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/events/[id]/export">,
): Promise<NextResponse> {
  const lecturer = await getCurrentLecturer();
  if (!lecturer) return jsonError("UNAUTHORIZED", "Chưa đăng nhập.", 401);

  const type = request.nextUrl.searchParams.get("type");
  if (type !== "summary" && type !== "raw") return jsonError("VALIDATION", "type phải là summary hoặc raw.", 400);

  const { id } = await params;
  const results = await getEventResults(lecturer.lecturerId, id);
  if (!results) return jsonError("NOT_FOUND", "Không tìm thấy buổi đánh giá.", 404);

  const csv = type === "summary" ? summaryCsv(results) : rawCsv(results);
  const filename = `peerscore-${results.event.code}-${type === "summary" ? "tong-hop" : "chi-tiet"}.csv`;
  return new NextResponse(csv, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
