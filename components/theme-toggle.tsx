"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof ORDER)[number];

const LABEL: Record<ThemeChoice, string> = { system: "Theo hệ thống", light: "Sáng", dark: "Tối" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

const subscribeNoop = () => () => {};

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return ORDER.some((choice) => choice === value);
}

/** Cycles system → light → dark. Renders a neutral icon until mounted (theme is client-only). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const current: ThemeChoice = isMounted && isThemeChoice(theme) ? theme : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
  const Icon = ICON[current];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Giao diện: ${LABEL[current]}. Bấm để chuyển sang ${LABEL[next]}`}
      title={`Giao diện: ${LABEL[current]}`}
    >
      <Icon aria-hidden />
    </Button>
  );
}
