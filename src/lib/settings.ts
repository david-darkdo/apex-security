import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  id: string | null;
  company_name: string | null;
  company_owner: string | null;
  company_phone: string | null;
  support_whatsapp: string | null;
  sales_whatsapp: string | null;
  company_email: string | null;
  company_address: string | null;
  company_state: string | null;
  company_country: string | null;
  company_service_area: string | null;
  master_description: string | null;
  short_description: string | null;
  seo_description: string | null;
  homepage_description: string | null;
  about_description: string | null;
  contact_description: string | null;
  footer_description: string | null;
  map_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  google_site_verification: string | null;
  bing_site_verification: string | null;
};

const DEFAULT_SETTINGS: AppSettings = {
  id: null,
  company_name: "Apex Security Ltd",
  company_owner: "Gift Fidelis",
  company_phone: "07063492581",
  support_whatsapp: "07063492581",
  sales_whatsapp: "07063492581",
  company_email: "igwezegift@gmail.com",
  company_address: "Opposite Timber Shed, Dei-Dei, Abuja, Nigeria",
  company_state: "Anambra",
  company_country: "Nigeria",
  company_service_area: "Nationwide",
  master_description:
    "Apex Security Ltd is a security solutions company serving customers across Abuja and nationwide Nigeria, with a business presence around Dei-Dei Building Materials Market. We provide modern security electronics and door solutions for homes, businesses and building projects, including CCTV cameras, solar CCTV systems, smart locks, security doors, flush doors, pivot doors and toilet doors. Our showroom brings practical security technology and contemporary door solutions together for customers looking to protect, upgrade and improve their properties.",
  short_description:
    "Apex Security Ltd provides CCTV systems, smart locks, security doors and modern door solutions for homes, businesses and building projects across Abuja and Nigeria.",
  seo_description:
    "Apex Security Ltd provides CCTV cameras, solar CCTV systems, smart locks, security doors and modern door solutions in Abuja, Nigeria. Serving residential, commercial and building projects nationwide, our showroom connects customers with practical security technology and quality door solutions around Dei-Dei Building Materials Market.",
  homepage_description:
    "Secure your space with modern technology and dependable door solutions. Apex Security Ltd brings CCTV cameras, solar security cameras, smart locks and quality security doors together for homes, businesses and building projects across Abuja and Nigeria.",
  about_description:
    "Apex Security Ltd is focused on helping customers protect and improve their properties through modern security technology and dependable door solutions. From CCTV surveillance and solar-powered cameras to smart locks, security doors, flush doors, pivot doors and toilet doors, we provide solutions suited to residential, commercial and building projects. Based around Dei-Dei, Abuja, we serve customers across Nigeria.",
  contact_description:
    "Connect with Apex Security Ltd for CCTV cameras, smart locks, security doors and modern door solutions. Our business is located opposite Timber Shed, Dei-Dei, Abuja, Nigeria, and we serve customers nationwide.",
  footer_description:
    "Apex Security Ltd — CCTV, smart locks and security door solutions for homes, businesses and building projects across Abuja and Nigeria.",
  map_url: "https://maps.google.com/?q=Opposite+Timber+Shed+Dei-Dei+Abuja+Nigeria",
  facebook_url: "https://facebook.com",
  instagram_url: "https://instagram.com",
  tiktok_url: "https://tiktok.com",
  youtube_url: "https://youtube.com",
  google_site_verification: null,
  bing_site_verification: null,
};

// Always returns a usable settings object. Safe Mode: on missing row or any
// failure, return DEFAULT_SETTINGS so UI never crashes.
export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return DEFAULT_SETTINGS;
    if (data) return data as AppSettings;

    // No row yet — try to seed one (requires admin RLS). Ignore failures.
    try {
      const { data: inserted } = await supabase
        .from("app_settings")
        .insert({} as never)
        .select("*")
        .maybeSingle();
      if (inserted) return inserted as AppSettings;
    } catch {
      /* RLS or network — fall back to in-memory defaults */
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const APP_SETTINGS_QUERY_KEY = ["app_settings"] as const;

export function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettings,
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: DEFAULT_SETTINGS,
  });
}

export function waLink(rawPhone: string | null | undefined, message?: string) {
  if (!rawPhone) return "#";
  const phone = rawPhone.replace(/[^\d]/g, "");
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
