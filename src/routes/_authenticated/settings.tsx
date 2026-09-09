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
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    company_name: "",
    company_owner: "",
    company_phone: "",
    support_whatsapp: "",
    sales_whatsapp: "",
    company_email: "",
    company_address: "",
    company_state: "",
    company_country: "",
    company_service_area: "",
    master_description: "",
    short_description: "",
    seo_description: "",
    homepage_description: "",
    about_description: "",
    contact_description: "",
    footer_description: "",
    map_url: "",
    banner_announcement: "",
    banner_announcement_enabled: true,
    watermark_text: "",
    watermark_enabled: true,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || "",
        company_owner: settings.company_owner || "",
        company_phone: settings.company_phone || "",
        support_whatsapp: settings.support_whatsapp || "",
        sales_whatsapp: settings.sales_whatsapp || "",
        company_email: settings.company_email || "",
        company_address: settings.company_address || "",
        company_state: settings.company_state || "",
        company_country: settings.company_country || "",
        company_service_area: settings.company_service_area || "",
        master_description: settings.master_description || "",
        short_description: settings.short_description || "",
        seo_description: settings.seo_description || "",
        homepage_description: settings.homepage_description || "",
        about_description: settings.about_description || "",
        contact_description: settings.contact_description || "",
        footer_description: settings.footer_description || "",
        map_url: settings.map_url || "",
        banner_announcement: settings.banner_announcement || "",
        banner_announcement_enabled: !!settings.banner_announcement_enabled,
        watermark_text: settings.watermark_text || "",
        watermark_enabled: !!settings.watermark_enabled,
      });
    }
  }, [settings]);

  if (authLoading || settingsLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-600" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-slate-600">
            Only Super Administrators can modify global company information, descriptions, and showroom settings.
          </p>
          <Link
            to="/home"
            className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Return to Showroom
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: existingRow } = await supabase
        .from("app_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      let err;
      if (existingRow?.id) {
        const { error } = await supabase
          .from("app_settings")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          })
          .eq("id", existingRow.id);
        err = error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({
            ...formData,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          });
        err = error;
      }

      if (err) throw err;

      toast.success("Apex Security settings updated successfully");
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY });
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-4">
          <SettingsIcon className="h-8 w-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Showroom Settings & Identity</h1>
            <p className="text-sm text-slate-500">
              Manage live company details, contact channels, descriptions, and showroom controls
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Company Identity */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Official Company Identity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Business Owner
                </label>
                <input
                  type="text"
                  value={formData.company_owner}
                  onChange={(e) => setFormData({ ...formData, company_owner: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Customer Service Phone
                </label>
                <input
                  type="text"
                  value={formData.company_phone}
                  onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  WhatsApp Support / Sales Number
                </label>
                <input
                  type="text"
                  value={formData.support_whatsapp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      support_whatsapp: e.target.value,
                      sales_whatsapp: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.company_state}
                  onChange={(e) => setFormData({ ...formData, company_state: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Business Address (Showroom & Office Location)
                </label>
                <input
                  type="text"
                  value={formData.company_address}
                  onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Google Maps URL
                </label>
                <input
                  type="url"
                  value={formData.map_url}
                  onChange={(e) => setFormData({ ...formData, map_url: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Service Area Scope
                </label>
                <input
                  type="text"
                  value={formData.company_service_area}
                  onChange={(e) => setFormData({ ...formData, company_service_area: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Company Positioning & Descriptions</h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Master Company Description (Official Overview)
              </label>
              <textarea
                rows={3}
                value={formData.master_description}
                onChange={(e) => setFormData({ ...formData, master_description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Short Description (Card & UI Summaries)
              </label>
              <textarea
                rows={2}
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                SEO & Meta Description
              </label>
              <textarea
                rows={2}
                value={formData.seo_description}
                onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Homepage Section Description
                </label>
                <textarea
                  rows={2}
                  value={formData.homepage_description}
                  onChange={(e) => setFormData({ ...formData, homepage_description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  About Section Description
                </label>
                <textarea
                  rows={2}
                  value={formData.about_description}
                  onChange={(e) => setFormData({ ...formData, about_description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Contact Page Description
                </label>
                <textarea
                  rows={2}
                  value={formData.contact_description}
                  onChange={(e) => setFormData({ ...formData, contact_description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Footer Positioning Description
                </label>
                <textarea
                  rows={2}
                  value={formData.footer_description}
                  onChange={(e) => setFormData({ ...formData, footer_description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Announcement Banner & Watermark */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Showroom Announcement & Watermark</h2>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="banner_enabled"
                checked={formData.banner_announcement_enabled}
                onChange={(e) => setFormData({ ...formData, banner_announcement_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="banner_enabled" className="text-sm font-medium text-slate-700">
                Enable Top Announcement Banner
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Announcement Text
              </label>
              <input
                type="text"
                value={formData.banner_announcement}
                onChange={(e) => setFormData({ ...formData, banner_announcement: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <input
                type="checkbox"
                id="watermark_enabled"
                checked={formData.watermark_enabled}
                onChange={(e) => setFormData({ ...formData, watermark_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="watermark_enabled" className="text-sm font-medium text-slate-700">
                Enable Image Watermark Protection
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Watermark Text
              </label>
              <input
                type="text"
                value={formData.watermark_text}
                onChange={(e) => setFormData({ ...formData, watermark_text: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Apex Security Settings"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
