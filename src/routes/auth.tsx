import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mergeGuestIntoUser } from "@/lib/collection";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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

  const targetPath = search.autoPush ? `${search.redirectTo || "/collection"}?autoPush=true` : (search.redirectTo || "/collection");

  if (user) {
    // Already signed in — redirect to destination
    setTimeout(() => {
      if (search.autoPush) {
        navigate({ to: "/collection", search: { autoPush: true } });
      } else {
        navigate({ to: (search.redirectTo as any) || "/collection" });
      }
    }, 0);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === "signup") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

        if (error) {
          if (error.message?.includes("weak_password") || (error as any)?.code === "weak_password") {
            throw new Error("Please choose a stronger password with a combination of letters, numbers, and symbols.");
          }
          throw error;
        }

        // If session was not automatically returned by signup, sign in immediately
        let userId = data.user?.id;
        if (!data.session) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (signInErr) throw signInErr;
          if (signInData.user?.id) {
            userId = signInData.user.id;
          }
        }

        if (userId) {
          try { await mergeGuestIntoUser(userId); } catch {}
        }

        toast.success("Account created successfully!");
        if (search.autoPush) {
          navigate({ to: "/collection", search: { autoPush: true } });
        } else {
          navigate({ to: (search.redirectTo as any) || "/collection" });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          try { await mergeGuestIntoUser(data.user.id); } catch {}
        }

        toast.success("Welcome back!");
        if (search.autoPush) {
          navigate({ to: "/collection", search: { autoPush: true } });
        } else {
          navigate({ to: (search.redirectTo as any) || "/collection" });
        }
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
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
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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
