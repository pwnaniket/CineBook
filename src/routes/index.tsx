import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useRef, useState, useEffect } from "react";
import { getNowShowingFeed, getTmdbFeeds, type HomeFeedItem } from "@/lib/home.functions";
import { MovieCardSkeleton } from "@/components/movie-card";
import { Ticket, Sparkles, Wallet, Star, CalendarClock, Flame, PlayCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div>
      <Hero />
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="space-y-14">
          <Suspense fallback={<><SectionHeaderSkeleton /><MoviesGridSkeleton /></>}>
            <NowShowingFeed />
          </Suspense>
          <Suspense fallback={<><SectionHeaderSkeleton /><MoviesGridSkeleton /></>}>
            <TmdbFeeds />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,oklch(0.55_0.22_18/0.25),transparent_50%),radial-gradient(circle_at_80%_10%,oklch(0.85_0.16_85/0.15),transparent_45%)]" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> A cinema at midnight
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.95] tracking-wide text-foreground sm:text-7xl">
            The best seat<br /> in the house is<br />
            <span className="marquee-text text-primary">yours to pick.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
            Real Bollywood and Hollywood showtimes. Row-by-row seat maps, hot snacks, wallet or card checkout, and a QR ticket at the gate.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/movies" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition hover:brightness-110">
              <Ticket className="h-4 w-4" /> Browse movies
            </Link>
            <Link to="/wallet" className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary">
              <Wallet className="h-4 w-4" /> Top up wallet
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border/40 pt-6">
            <Stat kv="12x16" label="seat matrix" />
            <Stat kv="4" label="seat classes" />
            <Stat kv="₹500" label="signup credit" />
          </dl>
        </div>
        <div className="relative hidden lg:block">
          <div className="ticket-stub relative rotate-2 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Cinebook • Screen 1</p>
                <p className="mt-2 font-display text-3xl tracking-wide">Blockbuster</p>
                <p className="text-sm text-muted-foreground">Hindi • U/A • 2h 32m</p>
              </div>
              <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Premium</span>
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {["E7", "E8", "E9", "E10"].map((s, i) => (
                <div key={s} className={"flex h-10 items-center justify-center rounded-md text-xs font-mono " + (i === 1 ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-foreground")}>{s}</div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-dashed border-border/60 pt-4 text-sm">
              <span className="text-muted-foreground">Fri, 9:15 PM</span>
              <span className="font-display text-2xl text-primary">₹1,300</span>
            </div>
          </div>
          <div className="ticket-stub absolute -bottom-6 -left-6 w-72 -rotate-6 rounded-2xl border border-border/60 bg-card p-4 shadow-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Snack combo</p>
            <p className="mt-1 font-display text-xl">Popcorn + Coke</p>
            <p className="mt-2 text-sm text-muted-foreground">Large caramel corn, refill Pepsi</p>
            <p className="mt-3 font-display text-xl text-primary">₹450</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ kv, label }: { kv: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-3xl text-foreground">{kv}</dt>
      <dd className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</dd>
    </div>
  );
}

function NowShowingFeed() {
  const fetchFeed = useServerFn(getNowShowingFeed);
  const { data } = useSuspenseQuery({
    queryKey: ["home-now-showing"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });
  return (
    <FeedSection
      eyebrow="Now showing"
      title="Book tickets today"
      icon={<PlayCircle className="h-3.5 w-3.5" />}
      items={data.nowShowing}
      variant="now_showing"
    />
  );
}

function TmdbFeeds() {
  const fetchFeeds = useServerFn(getTmdbFeeds);
  const { data } = useSuspenseQuery({
    queryKey: ["home-tmdb-feeds"],
    queryFn: () => fetchFeeds(),
    staleTime: 15 * 60_000,
  });
  return (
    <div className="space-y-14">
      <FeedSection
        eyebrow="Trending this week"
        title="What everyone's watching"
        icon={<Flame className="h-3.5 w-3.5" />}
        items={data.trending}
        variant="trending"
      />
      <FeedSection
        eyebrow="Coming soon"
        title="Releasing in the weeks ahead"
        icon={<CalendarClock className="h-3.5 w-3.5" />}
        items={data.upcoming}
        variant="upcoming"
      />
    </div>
  );
}

function MobileCarousel({ items, variant }: { items: HomeFeedItem[]; variant: "trending" | "upcoming" | "now_showing" }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hintSeen, setHintSeen] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const scrollLeft = track.scrollLeft;
      const cardWidth = track.firstElementChild?.clientWidth ?? 1;
      const gap = 12;
      const index = Math.round(scrollLeft / (cardWidth + gap));
      setActive(Math.max(0, Math.min(index, items.length - 1)));
      if (scrollLeft > 8) setHintSeen(true);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
  };

  return (
    <div className="relative -mx-4">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4"
      >
        {items.map((item) => (
          <div
            key={item.tmdb_id}
            className="w-[42vw] min-w-[148px] max-w-[180px] shrink-0 snap-start"
          >
            <FeedCard item={item} variant={variant} />
          </div>
        ))}
        {/* Peek spacer so the last card doesn't hug the edge */}
        <div className="w-4 shrink-0" aria-hidden="true" />
      </div>

      {/* Swipe hint */}
      <div
        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-opacity duration-500 ${hintSeen ? "opacity-0" : "opacity-100"}`}
        aria-hidden="true"
      >
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur">
          <ChevronRight className="h-3 w-3 animate-pulse text-primary" />
          swipe
        </div>
      </div>

      {/* Dot indicators */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FeedSection({
  eyebrow, title, icon, items, variant,
}: {
  eyebrow: string; title: string; icon: React.ReactNode;
  items: HomeFeedItem[]; variant: "trending" | "upcoming" | "now_showing";
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-5 flex items-end justify-between sm:mb-6">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-primary">
            {icon} {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-4xl tracking-wide text-foreground sm:text-5xl">{title}</h2>
        </div>
        <Link to="/movies" className="hidden text-sm font-medium text-primary hover:underline md:inline">Browse all →</Link>
      </div>
      {/* Mobile: premium snap carousel with hidden scrollbar + dot indicators */}
      <div className="block sm:hidden">
        <MobileCarousel items={items.slice(0, 10)} variant={variant} />
      </div>
      {/* Tablet/desktop: dense grid */}
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
        {items.slice(0, 10).map((m) => <FeedCard key={m.tmdb_id} item={m} variant={variant} />)}
      </div>
    </div>
  );
}

function FeedCard({ item, variant }: { item: HomeFeedItem; variant: "trending" | "upcoming" | "now_showing" }) {
  const [imgOk, setImgOk] = useState(true);
  const releaseLabel = item.release_date
    ? new Date(item.release_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  const inner = (
    <>
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-primary/20 via-secondary/40 to-background">
        {item.poster_url && imgOk ? (
          <img src={item.poster_url} alt={item.title} loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center font-display text-4xl uppercase tracking-widest text-primary/90">
            {item.title.slice(0, 2)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <RatingBadge imdb={item.imdb_rating} tmdb={item.tmdb_rating} />
        {variant === "upcoming" ? (
          <span className="absolute left-1.5 top-1.5 max-w-[55%] truncate rounded-md bg-accent/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-foreground sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-widest">
            Coming soon
          </span>
        ) : variant === "now_showing" ? (
          <span className="absolute left-1.5 top-1.5 max-w-[55%] truncate rounded-md bg-emerald-500/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-black sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-widest">
            Now showing
          </span>
        ) : (
          <span className="absolute left-1.5 top-1.5 max-w-[55%] truncate rounded-md bg-primary/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary-foreground sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-widest">
            Trending
          </span>
        )}
        {variant === "upcoming" && releaseLabel && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-md bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur">
            <span className="text-muted-foreground">Releases</span>
            <span className="text-primary">{releaseLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 font-display text-lg tracking-wide">{item.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {variant === "upcoming"
            ? releaseLabel ?? "TBA"
            : item.db_id ? "Book now" : "In theatres"}
        </p>
      </div>
    </>
  );

  const cls = "group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/10";

  if (item.db_id) {
    return (
      <Link to="/movies/$movieId" params={{ movieId: item.db_id }} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls + " cursor-default"}>{inner}</div>;
}

function SectionHeaderSkeleton() {
  return <div className="mb-6 h-12 w-64 animate-pulse rounded bg-muted" />;
}

/**
 * Rating badge. Prefers real IMDb (from OMDb). Falls back to TMDB score
 * with a clearly-labeled source pill. Shows "NR" when neither is available.
 */
function RatingBadge({ imdb, tmdb }: { imdb: number | null; tmdb: number | null }) {
  if (imdb != null && imdb > 0) {
    return (
      <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/80 px-1 py-0.5 font-mono text-[10px] text-foreground backdrop-blur sm:right-2 sm:top-2 sm:px-1.5 sm:py-1 sm:text-xs">
        <span className="rounded-sm bg-[#f5c518] px-1 text-[9px] font-bold text-black sm:text-[10px]">IMDb</span>
        <span className="text-primary">{imdb.toFixed(1)}</span>
      </span>
    );
  }
  if (tmdb != null && tmdb > 0) {
    return (
      <span
        className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/80 px-1 py-0.5 font-mono text-[10px] text-foreground backdrop-blur sm:right-2 sm:top-2 sm:px-1.5 sm:py-1 sm:text-xs"
        title="IMDb rating unavailable — showing TMDB score"
      >
        <Star className="h-3 w-3 fill-primary text-primary" />
        <span className="text-primary">{tmdb.toFixed(1)}</span>
        <span className="hidden text-[9px] uppercase tracking-wider text-muted-foreground sm:inline">TMDB</span>
      </span>
    );
  }
  return (
    <span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-widest">
      Not rated
    </span>
  );
}

function MoviesGridSkeleton() {
  return (
    <>
      <div className="block sm:hidden">
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[42vw] min-w-[148px] max-w-[180px] shrink-0">
              <MovieCardSkeleton />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
        {Array.from({ length: 10 }).map((_, i) => <MovieCardSkeleton key={i} />)}
      </div>
    </>
  );
}
