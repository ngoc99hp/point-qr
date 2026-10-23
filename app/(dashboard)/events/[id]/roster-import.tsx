"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { importRoster } from "@/app/actions/roster";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActionRunner } from "@/components/use-action-runner";
import { parseRoster } from "@/lib/roster";

const PREVIEW_ROWS = 8;
const SAMPLE = "MSV\tHọ tên\tNhóm\n2012345678\tĐào Anh Ngọc\tNhóm 1";

interface RosterImportProps {
  eventId: string;
  studentCodePattern: string;
  existingCodes: string[];
  /** Replace is blocked once ratings exist or a round is open (SPEC §6.4). */
  canReplace: boolean;
  disabled: boolean;
}

export function RosterImport({ eventId, studentCodePattern, existingCodes, canReplace, disabled }: RosterImportProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"replace" | "append">(existingCodes.length === 0 ? "replace" : "append");
  const { isPending, run } = useActionRunner();

  const preview = useMemo(() => (text.trim() ? parseRoster(text, studentCodePattern) : null), [text, studentCodePattern]);
  const existing = useMemo(() => new Set(existingCodes), [existingCodes]);
  const effectiveMode = canReplace ? mode : "append";
  const updates = preview ? preview.rows.filter((row) => effectiveMode === "append" && existing.has(row.code)).length : 0;
  const canSubmit = Boolean(preview && preview.errors.length === 0 && preview.rows.length > 0) && !disabled && !isPending;

  async function loadFile(file: File) {
    setText((await file.text()).replace(/^﻿/, ""));
  }

  function submit() {
    run(
      () => importRoster(eventId, text, effectiveMode),
      (summary) => {
        toast.success(`Đã nhập: ${summary.created} SV mới, ${summary.updated} cập nhật, ${summary.groupsCreated} nhóm mới.`);
        setText("");
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="roster-text">Dán từ Excel (gồm dòng tiêu đề: MSV, Họ tên, Nhóm) hoặc chọn file CSV</Label>
        <textarea
          id="roster-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={SAMPLE}
          rows={6}
          disabled={disabled || isPending}
          className="min-h-32 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        />
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          disabled={disabled || isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
            event.target.value = "";
          }}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1 file:text-sm"
          aria-label="Chọn file CSV"
        />
      </div>

      <fieldset className="flex flex-wrap gap-4 text-sm" disabled={disabled || isPending}>
        <legend className="sr-only">Chế độ nhập</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={effectiveMode === "append"} onChange={() => setMode("append")} />
          Bổ sung (MSV đã có thì cập nhật tên, nhóm)
        </label>
        <label className={canReplace ? "flex items-center gap-2" : "flex items-center gap-2 opacity-50"}>
          <input type="radio" name="mode" checked={effectiveMode === "replace"} disabled={!canReplace} onChange={() => setMode("replace")} />
          Thay thế toàn bộ danh sách
        </label>
      </fieldset>
      {!canReplace ? (
        <p className="text-sm text-muted-foreground">Đã có phiếu chấm hoặc đang mở phiên, chỉ dùng được chế độ bổ sung.</p>
      ) : null}

      {preview ? <RosterPreview preview={preview} updates={updates} /> : null}

      <Button onClick={submit} disabled={!canSubmit} className="self-start">
        {isPending ? "Đang nhập…" : "Xác nhận nhập danh sách"}
      </Button>
    </div>
  );
}

function RosterPreview({ preview, updates }: { preview: ReturnType<typeof parseRoster>; updates: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <strong>{preview.rows.length}</strong> dòng hợp lệ ({preview.rows.length - updates} thêm mới, {updates} cập nhật)
        {preview.errors.length > 0 ? (
          <span className="text-destructive"> · {preview.errors.length} dòng lỗi</span>
        ) : null}
      </p>
      {preview.errors.length > 0 ? (
        <ul role="alert" className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {preview.errors.map((error) => (
            <li key={`${error.line}-${error.message}`}>
              Dòng {error.line}: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
      {preview.rows.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MSV</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Nhóm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.slice(0, PREVIEW_ROWS).map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-mono">{row.code}</TableCell>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.groupName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview.rows.length > PREVIEW_ROWS ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">… và {preview.rows.length - PREVIEW_ROWS} dòng nữa</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
