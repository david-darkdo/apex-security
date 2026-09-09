import { supabase } from "@/integrations/supabase/client";

/**
 * Publishes indexnow / search console pings for newly added products or modified categories.
 */
export async function pingSearchEngines(url: string) {
  try {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("google_site_verification, bing_site_verification")
      .limit(1)
      .maybeSingle();

    if (!settings?.bing_site_verification) return;

    // IndexNow standard endpoint
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "apex-security-ltd.vercel.app",
        key: settings.bing_site_verification,
        urlList: [url],
      }),
    });
  } catch (err) {
    console.warn("IndexNow ping notice:", err);
  }
}
