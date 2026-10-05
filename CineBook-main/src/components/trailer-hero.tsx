import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Netflix-style hero: plays a muted, looped YouTube trailer as background
 * video, cropped to fill. Falls back to the static backdrop if no trailer
 * or the iframe fails to load. Only mounts one player at a time (the hero
 * of the currently viewed movie).
 */
export function TrailerHero({
  trailerKey,
  backdropUrl,
  title,
}: {
  trailerKey: string | null | undefined;
  backdropUrl: string | null | undefined;
  title: string;
}) {
  // Playback lifecycle:
  //  1) Show backdrop for 3s after mount.
  //  2) Auto-play trailer once.
  //  3) When trailer ends, revert to backdrop.
  //  4) After that, only replay when the user hovers/taps the hero.
  const [playing, setPlaying] = useState(false);
  const [autoPlayed, setAutoPlayed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial 3-second delay before the first autoplay.
  useEffect(() => {
    if (!trailerKey) return;
    const t = setTimeout(() => {
      setPlaying(true);
      setAutoPlayed(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [trailerKey]);

  // Listen for YouTube "ended" state (0) via postMessage.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === "onStateChange" && data.info === 0) {
          setPlaying(false);
        }
        if (data.event === "onReady") {
          // Subscribe to state changes.
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "listening" }),
            "*",
          );
        }
      } catch {}
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Pause / release the iframe when the component unmounts (navigating away).
  useEffect(() => {
    return () => {
      const f = iframeRef.current;
      if (f) f.src = "about:blank";
    };
  }, []);

  // Auto-mute the trailer when the hero scrolls out of view. The video keeps
  // playing (looping) — only audio is silenced. We never auto-unmute on
  // re-entry: respect that the user (or the default) wants silence.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && !muted) {
            postCmd("mute");
            setMuted(true);
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [muted]);

  function postCmd(func: "mute" | "unMute") {
    const f = iframeRef.current;
    if (!f?.contentWindow) return;
    f.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  }

  function toggleSound() {
    if (muted) {
      postCmd("unMute");
      setMuted(false);
    } else {
      postCmd("mute");
      setMuted(true);
    }
  }

  const showVideo = playing && !!trailerKey && !failed;

  return (
    <div
      ref={containerRef}
      className="relative h-56 w-full overflow-hidden sm:h-80 md:h-[28rem] lg:h-[34rem]"
      onMouseEnter={() => {
        if (autoPlayed && !playing) setPlaying(true);
      }}
      onTouchStart={() => {
        if (autoPlayed && !playing) setPlaying(true);
      }}
    >
      {/* Backdrop layer — always rendered so there's never a blank hero. */}
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-primary/20 to-transparent" />
      )}

      {/* YouTube trailer layer — scaled up to hide the letterbox bars. */}
      {showVideo && (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            ref={iframeRef}
            title={`${title} trailer`}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen={false}
            onError={() => setFailed(true)}
          />
        </div>
      )}

      <div className="movie-detail-hero-mask absolute inset-0" />

      {trailerKey && !failed && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-black/60 text-primary backdrop-blur transition hover:border-primary hover:bg-black/80 sm:right-6 sm:top-6"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}