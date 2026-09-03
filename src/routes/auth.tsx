import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mergeGuestIntoUser } from "@/lib/collection";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirectTo?: string; autoPush?: boolean } => {
    return {
      redirectTo: search.redirectTo ? String(search.redirectTo) : undefined,
      autoPush: search.autoPush === "true" || search.autoPush === true ? true : undefined,
    };
  },
  head: () => ({
    meta: [{ title: "Sign in — APEX SECURITY LIMITED" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  
  // State for unconfirmed email banner / screen
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [signupSuccessNotice, setSignupSuccessNotice] = useState<string | null>(null);

  const targetPath = search.autoPush ? `${search.redirectTo || "/collection"}?autoPush=true` : (search.redirectTo || "/collection");

  if (user) {
    // Already signed in — redirect to destination with autoPush
    setTimeout(() => {
      if (search.autoPush) {
        navigate({ to: "/collection", search: { autoPush: true } });
      } else {
        navigate({ to: (search.redirectTo as any) || "/collection" });
      }
    }, 0);
  }

  const handleResendConfirmation = async (targetEmail: string) => {
    if (!targetEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${targetPath}`,
        },
      });
      if (error) throw error;
      toast.success(`Verification link resent to ${targetEmail}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend confirmation email.");
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setUnconfirmedEmail(null);
    setSignupSuccessNotice(null);

    try {
      if (mode === "signup") {
        if (password.length < 8) {
          throw new Error("Please choose a password with at least 8 characters.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${targetPath}`,
            data: { full_name: fullName.trim() },
          },
        });

        if (error) {
          if (error.message?.includes("weak_password") || (error as any)?.code === "weak_password") {
            throw new Error("This password is too common or easily guessed. Please use a stronger password with a mix of letters, numbers, and symbols.");
          }
          throw error;
        }

        // If session exists (Email confirmation disabled or auto-confirmed)
        if (data.session && data.user) {
          try { await mergeGuestIntoUser(data.user.id); } catch {}
          toast.success("Account created and logged in!");
          if (search.autoPush) {
            navigate({ to: "/collection", search: { autoPush: true } });
          } else {
            navigate({ to: (search.redirectTo as any) || "/collection" });
          }
        } else if (data.user) {
          // Email confirmation is active in Supabase
          setSignupSuccessNotice(email.trim().toLowerCase());
          toast.success("Account created! Confirmation link sent.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("email not confirmed")) {
            setUnconfirmedEmail(email.trim().toLowerCase());
            throw new Error("Your email address has not been confirmed yet. Please check your inbox or resend the verification link below.");
          }
          if (msg.includes("invalid login credentials")) {
            // Provide dual guidance
            throw new Error("Invalid login credentials. If you just registered, make sure you clicked the activation link sent to your email, or check your password.");
          }
          throw error;
        }

        if (data.user) {
          try { await mergeGuestIntoUser(data.user.id); } catch {}
        }
        toast.success("Welcome back");
        if (search.autoPush) {
          navigate({ to: "/collection", search: { autoPush: true } });
        } else {
          navigate({ to: (search.redirectTo as any) || "/collection" });
        }
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const redirectUrl = `${window.location.origin}/collection?autoPush=true`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) {
      toast.error("Google sign-in failed: " + error.message);
      setBusy(false);
    }
  };

  // If newly signed up and waiting for email confirmation
  if (signupSuccessNotice) {
    return (
      <div className="container-app max-w-md py-12">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm text-center space-y-5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#1E82A6]/10 text-[#1E82A6]">
            <Mail className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Confirm Your Email</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We have sent a verification email to <strong className="text-foreground font-semibold">{signupSuccessNotice}</strong>.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please click the link inside the email to activate your account and log in.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => handleResendConfirmation(signupSuccessNotice)}
              disabled={resending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E82A6] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#176a88] transition shadow-xs disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
              <span>{resending ? "Resending…" : "Resend Verification Email"}</span>
            </button>
            <button
              onClick={() => {
                setSignupSuccessNotice(null);
                setMode("signin");
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2.5 text-xs font-bold text-foreground hover:bg-surface-2 transition"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app max-w-md py-10">
      <div className="mb-6 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E82A6]">
          APEX SECURITY LIMITED
        </span>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {mode === "signin"
            ? "Access your saved collections, orders, and security door quotes."
            : "Save & share architectural lookbooks and push directly to WhatsApp."}
        </p>
      </div>

      {unconfirmedEmail && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2.5 shadow-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Email confirmation required</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Your account for <strong className="font-semibold">{unconfirmedEmail}</strong> is awaiting email verification.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleResendConfirmation(unconfirmedEmail)}
            disabled={resending}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 transition"
          >
            <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
            <span>{resending ? "Resending…" : "Resend Activation Email"}</span>
          </button>
        </div>
      )}

      <button
        onClick={google}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-white px-4 py-2.5 text-xs font-bold text-foreground hover:bg-surface-2 transition shadow-xs"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-[#4285F4] shadow-xs border border-slate-100">G</span>
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
        <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Arc. David or Chief Japhet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1E82A6] focus:ring-1 focus:ring-[#1E82A6]"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">Email Address</label>
          <input
            type="email"
            required
            placeholder="yourname@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1E82A6] focus:ring-1 focus:ring-[#1E82A6]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-foreground">Password</label>
            {mode === "signup" && (
              <span className="text-[10px] text-muted-foreground">Min. 8 characters</span>
            )}
          </div>
          <input
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#1E82A6] focus:ring-1 focus:ring-[#1E82A6]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[#C0262D] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#9A1B21] disabled:opacity-60 transition shadow-sm mt-2"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        {mode === "signin" ? "Don't have an account yet?" : "Already have an account?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setUnconfirmedEmail(null);
            setSignupSuccessNotice(null);
          }}
          className="font-bold text-[#1E82A6] hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in here"}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">← Back to Showroom</Link>
      </p>
    </div>
  );
}
