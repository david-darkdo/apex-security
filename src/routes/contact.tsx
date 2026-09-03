import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppSettings, waLink } from "@/lib/settings";
import { toast } from "sonner";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Building2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — APEX SECURITY LIMITED" },
      { name: "description", content: "Contact APEX SECURITY LIMITED in Dei Dei, Abuja. Phone: 08035186355, 08151495663, 09040327777." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: s } = useAppSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const targetWa = s?.sales_whatsapp || "2348035186355";
      const msg = `Hello APEX SECURITY LIMITED! My name is ${name}. Please contact me regarding security doors and architectural hardware at ${phone}.`;
      window.open(waLink(targetWa, msg), "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp Sales Inquiry…");
      setName(""); setPhone("");
    } catch {
      toast.error("Couldn't open WhatsApp");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="container-app py-10 space-y-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E82A6]">Corporate Contacts</span>
          <h1 className="font-display text-3xl font-extrabold text-foreground mt-1">APEX SECURITY LIMITED</h1>
          <p className="mt-1 text-xs text-muted-foreground">Dealers & Suppliers of Premium Security Doors & Architectural Hardware. Visit our Head Office or Branch Office in Abuja.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {s?.map_url ? (
              <a
                href={s.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-border bg-white p-5 shadow-xs hover:border-[#C0262D] transition group"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-[#C0262D] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C0262D]">Head Office (Click for Map)</span>
                    <div className="font-bold text-sm text-foreground group-hover:text-[#C0262D] transition">Plot 469, Apex Security Plaza</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Saburi District Opp Timber Shed Dei Dei Building Material Mkt. FCT - Abuja</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-[#C0262D] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C0262D]">Head Office</span>
                    <div className="font-bold text-sm text-foreground">Plot 469, Apex Security Plaza</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Saburi District Opp Timber Shed Dei Dei Building Material Mkt. FCT - Abuja</p>
                  </div>
                </div>
              </div>
            )}

            {s?.map_url ? (
              <a
                href={s.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-border bg-white p-5 shadow-xs hover:border-[#1E82A6] transition group"
              >
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-[#1E82A6] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E82A6]">Branch Office (Click for Map)</span>
                    <div className="font-bold text-sm text-foreground group-hover:text-[#1E82A6] transition">Shop 819 C2 Extension</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Int'l Building Material Mkt Dei Dei, FCT Abuja</p>
                  </div>
                </div>
              </a>
            ) : (
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-[#1E82A6] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E82A6]">Branch Office</span>
                    <div className="font-bold text-sm text-foreground">Shop 819 C2 Extension</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Int'l Building Material Mkt Dei Dei, FCT Abuja</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-[#1E82A6] shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E82A6]">Telephone Lines</span>
                  <div className="font-bold text-sm text-foreground">0803 518 6355 | 0815 149 5663 | 0904 032 7777</div>
                </div>
              </div>
            </div>

            {s?.company_email && (
              <div className="rounded-xl border border-border bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-6 w-6 text-[#1E82A6] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E82A6]">Email Inquiry</span>
                    <div className="font-bold text-sm text-foreground">{s.company_email}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Direct Message to Sales</h3>
              <p className="mt-1 text-xs text-muted-foreground">Send an architectural inquiry directly to our sales department via WhatsApp.</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Your Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chief Japhet / Engr. Musa"
                    className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-[#1E82A6] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Phone / WhatsApp Number</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0803 123 4567"
                    className="w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-[#1E82A6] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C0262D] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#9A1B21] transition shadow-sm disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{busy ? "Opening…" : "Send WhatsApp Inquiry"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
