// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface AppSettings {
  id?: string;
  // Core Business Identity
  company_name: string;
  company_owner: string;
  company_phone: string;
  support_whatsapp: string;
  sales_whatsapp: string;
  company_email: string;
  company_address: string;
  company_state: string;
  company_country: string;
  company_service_area: string;
  // Descriptions
  master_description: string;
  short_description: string;
  seo_description: string;
  homepage_description: string;
  about_description: string;
  contact_description: string;
  footer_description: string;
  map_url: string;
  // Visual / Hero / Banners
  banner_announcement: string;
  banner_announcement_enabled: boolean;
  hero_title_override: string;
  hero_subtitle_override: string;
  // Watermark
  watermark_text: string;
  watermark_enabled: boolean;
  watermark_opacity: number;
  // Integrations / Custom Codes
  google_analytics_id: string;
  custom_css: string;
  custom_header_scripts: string;
  custom_footer_scripts: string;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: 'Apex Security Ltd',
  company_owner: 'Gift Fidelis',
  company_phone: '07063492581',
  support_whatsapp: '07063492581',
  sales_whatsapp: '07063492581',
  company_email: 'igwezegift@gmail.com',
  company_address: 'Opposite Timber Shed, Dei-Dei, Abuja, Nigeria',
  company_state: 'Anambra',
  company_country: 'Nigeria',
  company_service_area: 'Nationwide delivery and professional installation services across Nigeria.',
  master_description: 'Apex Security Ltd is Nigeria’s premier distributor and installer of advanced electronic security systems and luxury architectural entrance solutions. We engineer tailored security ecosystems featuring high-resolution AI CCTV surveillance, solar-powered off-grid remote cameras, biometric smart door locks, reinforced steel security doors, pivot entrance masterpieces, flush architectural doors, and waterproof interior doors designed to safeguard Nigerian homes and enterprises.',
  short_description: 'Advanced CCTV surveillance, biometric smart locks, luxury security doors, and architectural entrance solutions for modern residential, commercial, and industrial properties in Nigeria.',
  seo_description: 'Apex Security Ltd provides high-definition solar/wired CCTV cameras, biometric smart door locks, heavy-duty security doors, pivot doors, flush doors, and architectural entrance security across Nigeria.',
  homepage_description: 'Explore Nigeria’s trusted destination for high-definition solar & wired CCTV surveillance, biometric smart locks, heavy-duty security doors, and premium architectural entrance solutions engineered for residential and commercial security.',
  about_description: 'Apex Security Ltd, led by Gift Fidelis, delivers high-grade CCTV surveillance systems, intelligent biometric locks, and heavy-duty steel and pivot security doors to protect Nigerian homes, commercial facilities, and industrial compounds nationwide.',
  contact_description: 'Get in touch with Apex Security Ltd customer support, sales, and technical consultation for CCTV systems, biometric smart locks, security doors, and architectural entrance solutions across Nigeria.',
  footer_description: 'Nigeria’s premier provider of advanced CCTV surveillance, biometric smart locks, and reinforced architectural security doors. Engineered for robust safety and elegance.',
  map_url: 'https://maps.google.com/?q=Opposite+Timber+Shed+Dei-Dei+Abuja+Nigeria',
  banner_announcement: 'Welcome to Apex Security Ltd — Trusted Electronic Security, CCTV & Architectural Doors in Nigeria.',
  banner_announcement_enabled: true,
  hero_title_override: 'Engineered Security & Architectural Finishes',
  hero_subtitle_override: 'Premium solar & wired CCTV surveillance, biometric smart locks, reinforced steel security doors, and architectural entrance masterpieces tailored for Nigerian environments.',
  watermark_text: 'Apex Security Ltd',
  watermark_enabled: true,
  watermark_opacity: 0.25,
  google_analytics_id: '',
  custom_css: '',
  custom_header_scripts: '',
  custom_footer_scripts: '',
};

export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          return DEFAULT_SETTINGS;
        }

        return {
          ...DEFAULT_SETTINGS,
          ...data,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 mins
    refetchOnWindowFocus: false,
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updated: Partial<AppSettings>) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await supabase
          .from('app_settings')
          .update({
            ...updated,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert({
            ...DEFAULT_SETTINGS,
            ...updated,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(['app-settings'], (old: AppSettings | undefined) => ({
        ...(old || DEFAULT_SETTINGS),
        ...newData,
      }));
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });
}
