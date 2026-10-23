import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireLecturer } from "@/lib/auth";
import { getEventResults, type EventResults } from "@/lib/data/results";
import { formatScore } from "@/lib/format";
import { RANKING_METRIC_LABEL } from "@/lib/types/rating";
import { cn } from "@/lib/utils";
import { RatingsTable, type RatingFilter } from "./ratings-table";

export const metadata: Metadata = { title: "Kết quả · PeerScore" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const parseFilter = (value: string | undefined): RatingFilter =>
  value === "flagged" || value === "excluded" ? value : "all";

export default function ResultsPage({ params, searchParams }: PageProps<"/events/[id]/results">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-xl bg-muted" />}>
      <Results params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ lecturerId }, { id }, query] = await Promise.all([requireLecturer(), params, searchParams]);
  const results = await getEventResults(lecturerId, id);
  if (!results) notFound();

  const selected = results.groups.find((group) => group.id === first(query.group));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={`/events/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Thiết lập buổi đánh giá
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Kết quả: {results.event.title}</h1>
          <p className="text-sm text-muted-foreground">
            Xếp hạng theo {RANKING_METRIC_LABEL[results.event.rankingMetric].toLowerCase()}; hòa thì xét trung bình, rồi số phiếu.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/events/${id}/export?type=summary`} className={buttonVariants({ variant: "outline" })}>
            Tải CSV tổng hợp
          </a>
          <a href={`/api/events/${id}/export?type=raw`} className={buttonVariants({ variant: "outline" })}>
            Tải CSV chi tiết
          </a>
        </div>
      </div>

      <SummaryTable results={results} selectedId={selected?.id ?? null} />

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Phiếu chấm {selected.name}</CardTitle>
            <CardDescription>Phiếu bị loại không được tính vào thống kê.</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingsTable eventId={id} group={selected} filter={parseFilter(first(query.filter))} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Chọn một nhóm để rà soát từng phiếu.</p>
      )}
    </div>
  );
}

function SummaryTable({ results, selectedId }: { results: EventResults; selectedId: string | null }) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Hạng</TableHead>
            <TableHead>Nhóm</TableHead>
            <TableHead className="text-right">Số phiếu</TableHead>
            <TableHead className="text-right">TB</TableHead>
            <TableHead className="text-right">TB cắt</TableHead>
            <TableHead className="text-right">Trung vị</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead className="text-right">Max</TableHead>
            <TableHead className="text-right">Bị loại</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.groups.map((group) => (
            <TableRow key={group.id} className={cn(group.id === selectedId && "bg-muted")}>
              <TableCell className="font-semibold tabular-nums">{group.rank ?? "—"}</TableCell>
              <TableCell>
                <Link href={`/events/${results.event.id}/results?group=${group.id}`} className="font-medium underline-offset-4 hover:underline">
                  {group.name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{group.stats.n}</TableCell>
              <TableCell className="text-right tabular-nums">{formatScore(group.stats.mean)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatScore(group.stats.trimmedMean)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatScore(group.stats.median)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatScore(group.stats.lowest?.score ?? null)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatScore(group.stats.highest?.score ?? null)}</TableCell>
              <TableCell className="text-right tabular-nums">{group.stats.excludedCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
