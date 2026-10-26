import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/** Be Vietnam Pro: designed for Vietnamese diacritics; friendly, modern. 3 weights only (mobile perf). */
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PeerScore",
  description: "Sinh viên chấm điểm thuyết trình nhóm",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6ff" },
    { media: "(prefers-color-scheme: dark)", color: "#141029" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the `dark` class before hydration; suppress that expected mismatch.
    <html lang="vi" suppressHydrationWarning className={`${beVietnamPro.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-foreground">
        {/* Toaster lives in the dashboard layout so the mobile student page stays light. */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
