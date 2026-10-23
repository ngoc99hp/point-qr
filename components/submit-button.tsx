"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ComponentProps<typeof Button>, "type"> {
  pendingLabel: ReactNode;
}

/** Submit button that disables itself while its form action is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
