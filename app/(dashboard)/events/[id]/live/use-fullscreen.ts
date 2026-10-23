"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Fullscreen state of `ref` via the Fullscreen API, without effects (SPEC §6.2). */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null && document.fullscreenElement === ref.current,
    () => false,
  );
  const isSupported = useSyncExternalStore(
    subscribe,
    () => document.fullscreenEnabled,
    () => false,
  );

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void ref.current?.requestFullscreen();
    }
  }, [ref]);

  return { isFullscreen, isSupported, toggle };
}
