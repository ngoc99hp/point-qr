"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginFormState } from "./actions";

interface LoginFormProps {
  callbackUrl: string;
  /** Error carried in the URL (e.g. revoked session), shown until the next attempt. */
  initialError: string | null;
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<LoginFormState, FormData>(
    loginAction,
    null,
  );
  const error = state && !state.success ? state.error : state ? null : initialError;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
