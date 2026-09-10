import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, APP_SETTINGS_QUERY_KEY } from "@/lib/settings";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Company Settings — APEX SECURITY LIMITED" }] }),
  component: SettingsPage,
});

const FIELDS: [string, string, string?][] = [
  ["company_name", "Business / Company Name", "Official business name (e.g. Apex Security Ltd)"],
  ["company_owner", "Business Owner", "e.g. Gift Fidelis"],
  ["company_phone", "Customer Service Telephone", "Primary voice telephone line (e.g. 07063492581)"],
  ["support_whatsapp", "Support WhatsApp", "Used for the floating WhatsApp button (e.g. 07063492581)"],
  ["sales_whatsapp", "Sales WhatsApp", "Used for Push to WhatsApp from collections (e.g. 07063492581)"],
  ["company_email", "Company Email", "Official inquiries email (e.g. igwezegift@gmail.com)"],
  ["company_address", "Business Physical Address", "e.g. Opposite Timber Shed, Dei-Dei, Abuja, Nigeria"],
  ["company_state", "State", "State value (e.g. Anambra) — editable separately from address"],
  ["company_country", "Country", "e.g. Nigeria"],
  ["company_service_area", "Primary Service Area", "e.g. Nationwide"],
  ["master_description", "Master Company Description", "Comprehensive company positioning description"],
  ["short_description", "Short Company Description", "Concise description for compact UI locations"],
  ["seo_description", "Google / SEO Description", "Semantic description for search engines and metadata"],
  ["homepage_description", "Homepage Description", "Customer-facing description featured on the home route"],
  ["about_description", "About / Company Description", "Description for the About / company profile section"],
  ["contact_description", "Contact Page Description", "Description on the contact page"],
  ["footer_description", "Footer Description", "Concise identity text rendered in the footer"],
  ["map_url", "Google Map URL", "Full Google Maps / Business Profile URL"],
  ["facebook_url", "Facebook URL"],
  ["instagram_url", "Instagram URL"],
  ["tiktok_url", "TikTok URL"],
  ["youtube_url", "YouTube URL"],
  ["google_site_verification", "Google Site Verification", "Paste the Google Search Console meta tag content code"],
  ["bing_site_verification", "Bing Site Verification", "Paste the Bing Webmaster tools xml/meta verification code"],
];

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useAppSettings();
  const { loading: authLoading, isSuperAdmin } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    for (const [k] of FIELDS) next[k] = (settings as any)[k] ?? "";
    setForm(next);
  }, [settings]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, string | null> = {};
    for (const [k] of FIELDS) payload[k] = form[k]?.trim() || null;
    const { error } = settings?.id
      ? await supabase.from("app_settings").update(payload as any).eq("id", settings.id)
      : await supabase.from("app_settings").insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("APEX SECURITY Company Settings saved");
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
  };

  if (authLoading) {
    return <AppShell><div className="container-app py-10 text-sm text-muted-foreground">Loading settings…</div></AppShell>;
  }

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="container-app py-12">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <h1 className="font-display text-lg font-bold">Super Admin Only</h1>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              APEX SECURITY company settings can only be edited by a super admin.
            </p>
            <Link to="/account" className="mt-4 inline-block rounded-lg border border-border bg-surface-elevated px-4 py-2 text-xs font-bold text-foreground hover:bg-surface">
              Back to Account
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container-app py-8 space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <SettingsIcon className="h-6 w-6 text-brand-blue" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">APEX SECURITY Company Settings</h1>
            <p className="text-xs text-muted-foreground">
              Configure corporate phone numbers, WhatsApp, addresses, and Search Console verification tokens.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label, hint]) => (
            <label key={key} className="text-xs space-y-1">
              <span className="block font-bold uppercase tracking-wider text-brand-orange">
                {label}
              </span>
              <input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3.5 py-2 text-sm text-foreground outline-none focus:border-brand-orange"
              />
              {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
            </label>
          ))}
          <div className="sm:col-span-2 pt-2">
            <button
              disabled={saving}
              className="rounded-lg bg-brand-orange px-6 py-3 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover disabled:opacity-60 transition shadow-sm"
            >
              {saving ? "Saving…" : "Save APEX SECURITY Settings"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
