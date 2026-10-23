import { SubmitButton } from "@/components/submit-button";
import { requireLecturer, signOut } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/routes";

/** Reads the session, so it must render inside <Suspense> (Cache Components). */
export async function AccountMenu() {
  const lecturer = await requireLecturer();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: LOGIN_PATH });
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{lecturer.email}</span>
      <form action={signOutAction}>
        <SubmitButton variant="outline" size="sm" pendingLabel="Đang đăng xuất…">
          Đăng xuất
        </SubmitButton>
      </form>
    </div>
  );
}
