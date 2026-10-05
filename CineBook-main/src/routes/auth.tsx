import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Film, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => z.object({ next: z.string().optional() }).parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: next && next.startsWith("/") ? (next as "/") : "/", replace: true });
  }, [loading, user, next, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome, popcorn awaits.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
          <Film className="h-5 w-5 text-primary" />
        </span>
        <span className="font-display text-3xl tracking-[0.2em]">CINE<span className="text-primary">BOOK</span></span>
      </div>
      <div className="w-full rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex rounded-lg bg-secondary/40 p-1 text-sm">
          <button onClick={() => setMode("signin")} className={"flex-1 rounded-md py-1.5 transition " + (mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Sign in</button>
          <button onClick={() => setMode("signup")} className={"flex-1 rounded-md py-1.5 transition " + (mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Sign up</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Ada Lovelace" />
            </Field>
          )}
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="••••••••" />
          </Field>
          <button type="submit" disabled={submitting} className="mt-2 w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-50">
            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border/60" /> or <span className="h-px flex-1 bg-border/60" />
        </div>
        <button onClick={onGoogle} className="flex w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-background py-2.5 text-sm font-medium transition hover:border-primary/60">
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-1.72 3.8-5.5 3.8-3.32 0-6-2.74-6-6.1s2.68-6.1 6-6.1c1.88 0 3.14.8 3.86 1.5l2.64-2.53C16.94 3.13 14.7 2 12 2 6.98 2 3 5.98 3 11s3.98 9 9 9c5.2 0 8.63-3.66 8.63-8.8 0-.6-.06-1.05-.14-1.5H12z"/></svg>
          Continue with Google
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          New accounts get <span className="text-primary">₹500 welcome credit</span> in the wallet.
        </p>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">← Back to home</Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}