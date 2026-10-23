"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmDialogProps {
  /** The element that opens the dialog (rendered via asChild). */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** When set, the user must type this exact text before confirming. */
  requireText?: string;
  onConfirm: () => void;
  disabled?: boolean;
}

/** Destructive-action confirmation (SPEC §12 Dialog). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  requireText,
  onConfirm,
  disabled,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const canConfirm = !disabled && (!requireText || typed.trim().toUpperCase() === requireText.toUpperCase());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">{description}</div>
          </DialogDescription>
        </DialogHeader>
        {requireText ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-text">
              Gõ <span className="font-mono font-semibold">{requireText}</span> để xác nhận
            </Label>
            <Input id="confirm-text" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Hủy</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => {
              setOpen(false);
              setTyped("");
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
