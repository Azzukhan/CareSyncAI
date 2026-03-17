import { Badge } from "@/components/ui/badge";
import { Clock3, HeartPulse, QrCode, ShieldCheck, Users } from "lucide-react";

const solutionPoints = [
  {
    title: "Secure QR registration",
    description: "Patients register once and receive a digital identity card linked to their CareSync record.",
    icon: QrCode,
  },
  {
    title: "Cross-role visibility",
    description: "GPs, specialists, labs, and pharmacies work from the same care context with the correct permissions.",
    icon: Users,
  },
  {
    title: "Consent-aware access",
    description: "Patients retain visibility controls over visits, reports, and medication history.",
    icon: ShieldCheck,
  },
];

export default function About() {
  return (
    <div className="container py-8 md:py-10">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.05),transparent_24%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 shadow-[0_28px_90px_rgba(2,6,23,0.45)] sm:p-10 lg:p-12">
        <Badge className="border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200 hover:bg-amber-400/10">
          About CareSync
        </Badge>
        <div className="mt-6 max-w-4xl">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            A connected access layer for modern NHS care journeys
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-400">
            CareSync is designed to reduce fragmented records, repeated patient history intake,
            and slow care coordination by connecting patients, GP teams, specialists, labs, and
            pharmacies through one secure platform.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { value: "1", label: "Patient identity flow" },
            { value: "5", label: "Connected healthcare roles" },
            { value: "Private", label: "Consent-led sharing model" },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-3xl font-semibold text-amber-300">{item.value}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[34px] border border-white/10 bg-slate-950/45 p-8 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <div className="flex items-center gap-3 text-amber-300">
            <Clock3 className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.24em]">The NHS problem today</p>
          </div>
          <p className="mt-5 text-base leading-8 text-slate-400">
            Waiting lists remain high, administrative duplication is expensive, and fragmented
            records force patients to repeat the same information across the system. That slows
            triage, handoffs, referrals, tests, and prescriptions.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-1 h-5 w-5 text-cyan-200" />
              <div>
                <p className="text-base font-semibold text-slate-100">
                  CareSync keeps the care trail connected
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The platform is meant to reduce duplicated history gathering and improve clarity
                  across each patient touchpoint rather than adding another isolated portal.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[34px] border border-white/10 bg-slate-950/45 p-8 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            The CareSync solution
          </p>
          <div className="mt-6 grid gap-4">
            {solutionPoints.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                    <item.icon className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
