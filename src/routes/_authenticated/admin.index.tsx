import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, APP_SETTINGS_QUERY_KEY } from "@/lib/settings";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, Settings as SettingsIcon, Package, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Command Center — Apex Security Ltd" }] }),
  component: AdminPage,
});

const ROLE_OPTIONS: AppRole[] = ["customer", "admin", "super_admin"];

type UserRow = {
  auth_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useAppSettings();
  const { user, loading: authLoading, isAdmin, isSuperAdmin } = useAuth();

  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    if (!settings) return;
    setForm({
      support_whatsapp: settings.support_whatsapp ?? "",
      sales_whatsapp: settings.sales_whatsapp ?? "",
      company_email: settings.company_email ?? "",
      company_address: settings.company_address ?? "",
      map_url: settings.map_url ?? "",
      facebook_url: settings.facebook_url ?? "",
      instagram_url: settings.instagram_url ?? "",
      tiktok_url: settings.tiktok_url ?? "",
    });
  }, [settings]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,code,is_published,is_ai_processing,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setProducts(data ?? []);
    })();
  }, [isAdmin]);

  const loadUsers = useMemo(
    () => async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("auth_id, email, full_name")
        .order("created_at", { ascending: false });
      if (pErr) {
        toast.error(pErr.message);
        return;
      }
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) {
        toast.error(rErr.message);
        return;
      }
      const roleMap = new Map<string, AppRole>();
      // pick highest privilege role per user
      const rank: Record<AppRole, number> = { customer: 0, admin: 1, super_admin: 2 };
      for (const r of roles as Array<{ user_id: string; role: AppRole }>) {
        const prev = roleMap.get(r.user_id);
        if (!prev || rank[r.role] > rank[prev]) roleMap.set(r.user_id, r.role);
      }
      setUsers(
        ((profiles ?? []) as Array<{ auth_id: string; email: string | null; full_name: string | null }>).map(
          (p) => ({
            auth_id: p.auth_id,
            email: p.email,
            full_name: p.full_name,
            role: roleMap.get(p.auth_id) ?? "customer",
          })
        )
      );
    },
    []
  );

  useEffect(() => {
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, loadUsers]);

  if (authLoading) {
    return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please sign in.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-app py-10">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in but don't have admin access. Ask a super admin to grant your account the <code>admin</code> role.
        </p>
      </div>
    );
  }

  const searchByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("products")
      .select("slug")
      .ilike("code", code.trim())
      .maybeSingle();
    setSearching(false);
    if (data?.slug) navigate({ to: "/product/$slug", params: { slug: data.slug } });
    else toast.error(`No product with code "${code}"`);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error("Only super admins can edit company settings.");
      return;
    }
    setSavingSettings(true);
    const payload: Record<string, string | null> = {};
    for (const k of Object.keys(form)) payload[k] = form[k]?.trim() || null;
    const { error } = settings?.id
      ? await supabase.from("app_settings").update(payload as never).eq("id", settings.id)
      : await supabase.from("app_settings").insert(payload as never);
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
  };

  const updateUserRole = async (target: UserRow, nextRole: AppRole) => {
    if (!isSuperAdmin) return;
    if (target.auth_id === user.id && target.role === "super_admin" && nextRole !== "super_admin") {
      if (!confirm("You are about to remove your own super admin role. Continue?")) return;
    }
    // Wipe existing rows then insert the new role (single-role model in UI)
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", target.auth_id);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: target.auth_id, role: nextRole } as never);
    if (insErr) return toast.error(insErr.message);
    setUsers((rows) => rows.map((r) => (r.auth_id === target.auth_id ? { ...r, role: nextRole } : r)));
    toast.success(`Role updated to ${nextRole}`);
  };

  const toggleAiProcessing = async (id: string, current: boolean) => {
    const next = !current;
    const { error } = await supabase
      .from("products")
      .update({ is_ai_processing: next } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, is_ai_processing: next } : p)));
    toast.success(next ? "AI generation queued (stub)" : "AI flag cleared");
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setProducts((p) => p.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="container-app py-6 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage products, contact info & inquiries.</p>
      </div>

      <CustomerAnalyticsCards />


      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Search className="h-4 w-4 text-primary" /> Product Code Search
        </h2>
        <p className="text-xs text-muted-foreground">Open a product instantly by its code.</p>
        <form onSubmit={searchByCode} className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. TIL-CAR-001"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button disabled={searching} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {searching ? "…" : "Open"}
          </button>
        </form>
      </section>

      {isSuperAdmin && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <SettingsIcon className="h-4 w-4 text-primary" /> Company Settings
          </h2>
          <p className="text-xs text-muted-foreground">
            Used across the site (Contact, Footer, Floating WhatsApp, Push to WhatsApp).
          </p>
          <form onSubmit={saveSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["support_whatsapp", "Support WhatsApp"],
              ["sales_whatsapp", "Sales WhatsApp"],
              ["company_email", "Company Email"],
              ["company_address", "Company Address"],
              ["map_url", "Map URL"],
              ["facebook_url", "Facebook URL"],
              ["instagram_url", "Instagram URL"],
              ["tiktok_url", "TikTok URL"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
                <input
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <button disabled={savingSettings} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {savingSettings ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isSuperAdmin && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="h-4 w-4 text-primary" /> User Management
          </h2>
          <p className="text-xs text-muted-foreground">
            Update roles directly. Hierarchy: customer &lt; admin &lt; super_admin.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Current Role</th>
                  <th className="py-2 pr-3">Update Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (\n                  <tr key={u.auth_id}>\n                    <td className=\"py-2 pr-3 font-medium\">{u.full_name || \"—\"}</td>\n                    <td className=\"py-2 pr-3 text-muted-foreground\">{u.email || \"—\"}</td>\n                    <td className=\"py-2 pr-3\">\n                      <span className=\"inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-primary\">\n                        {u.role}\n                      </span>\n                    </td>\n                    <td className=\"py-2 pr-3\">\n                      <select\n                        value={u.role}\n                        onChange={(e) => updateUserRole(u, e.target.value as AppRole)}\n                        className=\"rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary\"\n                      >\n                        {ROLE_OPTIONS.map((r) => (\n                          <option key={r} value={r}>\n                            {r}\n                          </option>\n                        ))}\n                      </select>\n                    </td>\n                  </tr>\n                ))}\n                {users.length === 0 && (\n                  <tr>\n                    <td colSpan={4} className=\"py-4 text-center text-xs text-muted-foreground\">\n                      No users found.\n                    </td>\n                  </tr>\n                )}\n              </tbody>\n            </table>\n          </div>\n        </section>\n      )}\n\n      <section className=\"rounded-xl border border-border bg-card p-5\">\n        <h2 className=\"flex items-center gap-2 font-display text-lg font-semibold\">\n          <Package className=\"h-4 w-4 text-primary\" /> Products\n        </h2>\n        <p className=\"text-xs text-muted-foreground\">Most recent 50 products.</p>\n        <ul className=\"mt-3 divide-y divide-border\">\n          {products.map((p) => (\n            <li key={p.id} className=\"flex flex-wrap items-center gap-2 py-2 text-sm\">\n              <div className=\"min-w-0 flex-1\">\n                <Link to=\"/product/$slug\" params={{ slug: p.slug }} className=\"block truncate font-medium hover:text-primary\">\n                  {p.name}\n                </Link>\n                <div className=\"text-xs text-muted-foreground\">\n                  Code · {p.code} · {p.is_published ? \"Published\" : \"Draft\"}\n                  {p.is_ai_processing ? \" · AI processing…\" : \"\"}\n                </div>\n              </div>\n              <button\n                onClick={() => toggleAiProcessing(p.id, p.is_ai_processing)}\n                className=\"rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10\"\n              >\n                {p.is_ai_processing ? \"Regenerate AI Assets\" : \"Generate AI Assets\"}\n              </button>\n              <button onClick={() => deleteProduct(p.id)} className=\"rounded-md border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10\">\n                Delete\n              </button>\n            </li>\n          ))}\n        </ul>\n      </section>\n    </div>\n  );\n}\n\nfunction CustomerAnalyticsCards() {\n  const [stats, setStats] = useState<Record<string, number>>({});\n  useEffect(() => {\n    (async () => {\n      const [{ data: profs }, { data: roles }, { data: colls }, { data: inqs }, { data: camps }] = await Promise.all([\n        supabase.from(\"profiles\").select(\"email,vip_status\"),\n        supabase.from(\"user_roles\").select(\"account_status\"),\n        supabase.from(\"collections\").select(\"id\"),\n        supabase.from(\"whatsapp_inquiries\").select(\"id\"),\n        supabase.from(\"email_campaigns\" as any).select(\"status\"),\n      ]);\n      const total = profs?.length ?? 0;\n      const google = (profs ?? []).filter((p: any) => p.email && /@gmail\\./i.test(p.email)).length;\n      const email = total - google;\n      const active = (roles ?? []).filter((r: any) => (r.account_status ?? \"ACTIVE\") === \"ACTIVE\").length;\n      const suspended = (roles ?? []).filter((r: any) => r.account_status === \"SUSPENDED\" || r.account_status === \"BLOCKED\").length;\n      const vip = (profs ?? []).filter((p: any) => p.vip_status).length;\n      const campsTotal = camps?.length ?? 0;\n      const campsSent = (camps ?? []).filter((c: any) => c.status === \"SENT\").length;\n      setStats({ total, google, email, active, suspended, vip, colls: colls?.length ?? 0, inqs: inqs?.length ?? 0, campsTotal, campsSent });\n    })();\n  }, []);\n  const cards = [\n    [\"Total users\", stats.total], [\"Google\", stats.google], [\"Email\", stats.email],\n    [\"Active\", stats.active], [\"Suspended\", stats.suspended], [\"VIP\", stats.vip],\n    [\"Collections\", stats.colls], [\"WhatsApp inquiries\", stats.inqs],\n    [\"Campaigns created\", stats.campsTotal], [\"Campaigns sent\", stats.campsSent],\n  ] as const;\n  return (\n    <section>\n      <h2 className=\"mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground\">Customer Analytics</h2>\n      <div className=\"grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5\">\n        {cards.map(([label, v]) => (\n          <div key={label} className=\"rounded-lg border border-border bg-card p-3\">\n            <div className=\"text-[10px] uppercase text-muted-foreground\">{label}</div>\n            <div className=\"mt-1 text-xl font-semibold\">{v ?? 0}</div>\n          </div>\n        ))}\n      </div>\n    </section>\n  );\n}\n