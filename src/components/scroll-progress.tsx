import { useEffect, useState } from "react";

/**
 * Ultra-thin gold progress bar fixed at the top of the viewport.
 * Replaces the browser scrollbar for a premium, cinematic feel.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const p = Math.min(100, Math.max(0, (scrollTop / max) * 100));
      setProgress(p);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
    >
      <div
        className="h-full origin-left will-change-transform"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: "transform 120ms linear",
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--gold) 20%, transparent) 0%, var(--gold) 45%, color-mix(in oklab, var(--gold) 60%, white) 100%)",
          boxShadow:
            "0 0 10px color-mix(in oklab, var(--gold) 60%, transparent), 0 0 24px color-mix(in oklab, var(--gold) 30%, transparent)",
        }}
      />
    </div>
  );
}