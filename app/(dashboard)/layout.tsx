import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { BrandLogo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-md">
        <div aria-hidden className="h-1 bg-brand-gradient" />
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/events" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Suspense fallback={<div className="h-8 w-24 rounded-md bg-muted" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-10">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  );
}
