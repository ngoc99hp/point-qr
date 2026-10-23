import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireLecturer, signOut } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Buổi đánh giá · PeerScore" };

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Buổi đánh giá</h1>
      <Suspense fallback={<div className="h-32 rounded-xl bg-muted" />}>
        <LecturerCard />
      </Suspense>
    </div>
  );
}

async function LecturerCard() {
  const lecturer = await requireLecturer();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: LOGIN_PATH });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Xin chào{lecturer.name ? `, ${lecturer.name}` : ""}</CardTitle>
        <CardDescription>
          Đang đăng nhập với <span className="font-medium">{lecturer.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Chức năng tạo và quản lý buổi đánh giá sẽ có ở phiên bản tiếp theo.
        </p>
        <form action={signOutAction}>
          <SubmitButton variant="outline" pendingLabel="Đang đăng xuất…">
            Đăng xuất
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
