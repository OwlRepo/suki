import { useEffect, useRef, useState } from "react";

const REVEAL_INTERVAL_MS = 16;
const TARGET_DRAIN_FRAMES = 24;

type UseProgressiveAssistantTextOptions = {
  targetText: string;
  enabled: boolean;
  onProgress?: (visibleText: string) => void;
  onRevealChange?: (isRevealing: boolean) => void;
};

function prefersReducedMotion() {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useProgressiveAssistantText({
  targetText,
  enabled,
  onProgress,
  onRevealChange,
}: UseProgressiveAssistantTextOptions) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const animate = enabled && !reducedMotion;
  const [animatedVisibleText, setAnimatedVisibleText] = useState(() =>
    animate ? "" : targetText,
  );
  const visibleText = animate
    ? targetText.startsWith(animatedVisibleText)
      ? animatedVisibleText
      : ""
    : targetText;
  const previousRevealState = useRef<boolean | null>(null);
  const previousProgressText = useRef(visibleText);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return;
    const mediaQuery = globalThis.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (!animate) return;
    if (visibleText.length >= targetText.length) return;

    const timer = window.setTimeout(() => {
      setAnimatedVisibleText((current) => {
        const base = targetText.startsWith(current) ? current : "";
        const remaining = targetText.length - base.length;
        const batchSize = Math.max(
          1,
          Math.ceil(remaining / TARGET_DRAIN_FRAMES),
        );
        return targetText.slice(0, base.length + batchSize);
      });
    }, REVEAL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [animate, targetText, visibleText]);

  const isRevealing = animate && visibleText.length < targetText.length;

  useEffect(() => {
    if (
      visibleText !== previousProgressText.current &&
      visibleText.length > 0
    ) {
      onProgress?.(visibleText);
      previousProgressText.current = visibleText;
    }
  }, [onProgress, visibleText]);

  useEffect(() => {
    if (previousRevealState.current === isRevealing) return;
    previousRevealState.current = isRevealing;
    onRevealChange?.(isRevealing);
  }, [isRevealing, onRevealChange]);

  return { visibleText, isRevealing };
}
