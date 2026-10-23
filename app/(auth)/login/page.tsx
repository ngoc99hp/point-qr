import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLoginErrorMessage } from "@/lib/login-error";
import { safeCallbackUrl } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập · PeerScore" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">PeerScore</CardTitle>
          <CardDescription>Đăng nhập tài khoản quản trị để quản lý buổi đánh giá.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-48 rounded-md bg-muted" />}>
            <LoginFormFromParams searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginFormFromParams({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      callbackUrl={safeCallbackUrl(firstParam(params.callbackUrl))}
      initialError={getLoginErrorMessage(firstParam(params.error))}
    />
  );
}
