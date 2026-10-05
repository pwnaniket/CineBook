import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { User as UserIcon, Loader2, KeyRound, Mail } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  wallet_balance: number;
};

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  // profile form fields
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string>("");
  const [phone, setPhone] = useState("");

  // email + password
  const [newEmail, setNewEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/account" }, replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
      } else if (data) {
        const p = data as ProfileRow;
        setProfile(p);
        setFullName(p.full_name ?? "");
        setDisplayName(p.display_name ?? "");
        setDob(p.date_of_birth ?? "");
        setGender(p.gender ?? "");
        setPhone(p.phone ?? "");
        setNewEmail(p.email ?? user.email ?? "");
      }
      setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (phone && !/^[+()\-\s\d]{7,20}$/.test(phone)) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim() || null,
      display_name: displayName.trim() || null,
      date_of_birth: dob || null,
      gender: gender || null,
      phone: phone.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
    }
  }

  async function onChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const email = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (email === (user.email ?? "").toLowerCase()) {
      toast.info("That's already your email.");
      return;
    }
    setEmailSubmitting(true);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/account` }
    );
    setEmailSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your new inbox to confirm the change.");
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPasswordSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  if (loading || fetching) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
          <UserIcon className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="font-display text-3xl tracking-[0.15em]">ACCOUNT</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, email, and password.
            {profile && (
              <> · Wallet <span className="text-primary">₹{Number(profile.wallet_balance).toFixed(2)}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Profile card */}
      <section className="mb-8 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/40">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Personal details</h2>
        <form onSubmit={onSaveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="Ada Lovelace" maxLength={100} />
          </Field>
          <Field label="Display name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" placeholder="ada" maxLength={40} />
          </Field>
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+91 98765 43210" maxLength={20} />
          </Field>
          <Field label="Current email">
            <input value={user.email ?? ""} disabled className="input opacity-60" />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Change email */}
      <section className="mb-8 rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Change email</h2>
        </div>
        <form onSubmit={onChangeEmail} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="New email address">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input" placeholder="new@example.com" required />
          </Field>
          <button type="submit" disabled={emailSubmitting} className="h-[42px] rounded-md border border-border/60 bg-secondary/40 px-5 text-sm font-semibold transition hover:border-primary/60 hover:text-primary disabled:opacity-50">
            {emailSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Send verification"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          We'll send a confirmation link to the new address. Your email won't change until you click it.
        </p>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Change password</h2>
        </div>
        <form onSubmit={onChangePassword} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="New password">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder="••••••••" minLength={6} required />
          </Field>
          <Field label="Confirm password">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="••••••••" minLength={6} required />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={passwordSubmitting} className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-50">
              {passwordSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Update password"}
            </button>
          </div>
        </form>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">← Back to home</Link>
      </p>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border) / 0.6);
          background: hsl(var(--background));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
        }
        .input:focus { outline: none; border-color: hsl(var(--primary)); }
      `}</style>
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