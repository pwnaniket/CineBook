import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart-store";
import { Ticket, Wallet, ScanLine, LogOut, User as UserIcon, Film, UserCog } from "lucide-react";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const { seats, snacks } = useCart();
  const itemCount = seats.length + snacks.reduce((a, s) => a + s.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
            <Film className="h-5 w-5 text-primary" />
          </span>
          <span className="font-display text-2xl tracking-[0.18em] text-foreground">
            CINE<span className="text-primary">BOOK</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/theaters">Theaters</NavLink>
          <NavLink to="/scanner">Scanner</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/wallet" className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/50 hover:text-primary sm:inline-flex">
                <Wallet className="h-4 w-4" /> Wallet
              </Link>
              <Link to="/account" title="Account" className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/50 hover:text-primary sm:inline-flex">
                <UserCog className="h-4 w-4" /> Account
              </Link>
              <Link to="/bookings" className="relative inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/50 hover:text-primary">
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">Tickets</span>
                {itemCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Link>
              <button onClick={signOut} title="Sign out" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:border-destructive/60 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110">
              <UserIcon className="h-4 w-4" /> Sign in
            </Link>
          )}
          <Link to="/scanner" title="Scanner" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:border-primary/60 hover:text-primary md:hidden">
            <ScanLine className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-primary bg-primary/10" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/40 bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-10 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p className="font-display tracking-[0.3em] text-foreground/80">CINEBOOK</p>
        <p className="mt-2">A premium movie-ticket experience • Built as an academic project</p>
        <p className="mt-1 text-xs">Data provided by TMDB. This product uses the TMDB API but is not endorsed by TMDB.</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          Secured by <span className="font-semibold text-foreground">Razorpay</span> · Test Mode
        </div>
      </div>
    </footer>
  );
}