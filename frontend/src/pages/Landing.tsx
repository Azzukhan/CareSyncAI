import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  FlaskConical,
  HeartPulse,
  Lock,
  Pill,
  QrCode,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getHealthTips } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.08, duration: 0.45 },
  }),
};

const trustSignals = [
  { value: "1", label: "Secure patient identity" },
  { value: "5", label: "Connected care roles" },
  { value: "24/7", label: "Protected workspace access" },
];

const careRoles = [
  { label: "Patient", icon: UserRound },
  { label: "GP", icon: Stethoscope },
  { label: "Specialist", icon: ShieldCheck },
  { label: "Lab", icon: FlaskConical },
  { label: "Pharmacy", icon: Pill },
];

const featureCards = [
  {
    title: "One scan, full care context",
    description:
      "CareSync gives verified providers the right patient context at the right moment without repeated history collection.",
    icon: QrCode,
  },
  {
    title: "Consent-led record sharing",
    description:
      "Patients manage visibility across visits, reports, and medicines while keeping providers aligned.",
    icon: Lock,
  },
  {
    title: "Faster referral coordination",
    description:
      "GPs, specialists, labs, and pharmacies work from the same record trail instead of disconnected handoffs.",
    icon: Users,
  },
];

const journeySteps = [
  {
    step: "01",
    title: "Register once",
    description: "Create your patient account with your NHS-linked identity.",
  },
  {
    step: "02",
    title: "Show your digital health card",
    description: "Present your QR pass whenever CareSync-enabled care begins.",
  },
  {
    step: "03",
    title: "Let providers coordinate",
    description: "Visits, labs, referrals, and medicines stay connected across the journey.",
  },
];

export default function Landing() {
  const { data: healthTips = [], isLoading } = useQuery({
    queryKey: ["health-tips"],
    queryFn: getHealthTips,
  });

  return (
    <div className="container py-8 md:py-10">
      <section className="grid overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/55 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:grid-cols-[1.04fr_0.96fr]">
        <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.06),transparent_24%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
          <Badge className="border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200 hover:bg-amber-400/10">
            NHS-linked access
          </Badge>

          <div className="mt-8 max-w-xl">
            <p
              className="text-5xl leading-[0.92] tracking-tight text-slate-50 sm:text-6xl"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <span className="block">Healthcare access</span>
              <span className="block">that stays</span>
              <span className="block">
                connected and <span className="italic text-amber-300">clear.</span>
              </span>
            </p>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">
              CareSync gives patients and care teams one shared access layer for dashboards,
              digital health cards, referrals, records, and secure clinical coordination.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {careRoles.map((role) => (
              <div
                key={role.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300"
              >
                <role.icon className="h-4 w-4 text-amber-300" />
                <span>{role.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <Button className="h-12 rounded-2xl border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.24)] hover:bg-[#dfc165]">
                Create patient account
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="outline"
                className="h-12 rounded-2xl border-white/10 bg-white/[0.03] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-100 hover:bg-white/[0.06]"
              >
                Enter workspace
              </Button>
            </Link>
          </div>

          <div className="mt-14 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            {trustSignals.map((signal) => (
              <div key={signal.label}>
                <p className="text-3xl font-semibold text-amber-300">{signal.value}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {signal.label}
                </p>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute bottom-4 right-6 text-[12rem] font-semibold leading-none text-white/[0.03]">
            C
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,#101923_0%,#0e1823_100%)] p-8 sm:p-10 lg:p-12">
          <div className="grid gap-4">
            {featureCards.map((item, index) => (
              <motion.div
                key={item.title}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(2,6,23,0.18)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                    <item.icon className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Patient journey</p>
            <div className="mt-4 space-y-4">
              {journeySteps.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/10 text-sm font-semibold text-amber-200">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[34px] border border-white/10 bg-slate-950/45 p-8 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Why CareSync</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
            Built for care journeys, not disconnected admin steps
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock3,
                title: "Reduce repeat history collection",
                description: "Providers start with context instead of re-asking the same questions.",
              },
              {
                icon: HeartPulse,
                title: "Keep records in sync",
                description: "Visits, reports, medicines, and AI-supported plans stay connected.",
              },
              {
                icon: ShieldCheck,
                title: "Keep access controlled",
                description: "Patient privacy controls remain visible across the full workflow.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <item.icon className="h-5 w-5 text-amber-300" />
                <p className="mt-4 text-base font-semibold text-slate-100">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_34%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 shadow-[0_22px_60px_rgba(2,6,23,0.24)]">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Latest guidance</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
            Health tips inside the same CareSync theme
          </h2>
          <div className="mt-6 space-y-4">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                    <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-white/10" />
                    <div className="mt-3 h-12 animate-pulse rounded bg-white/10" />
                  </div>
                ))
              : healthTips.slice(0, 3).map((tip) => (
                  <div key={tip.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                          {tip.category}
                        </Badge>
                        <p className="mt-4 text-lg font-semibold text-slate-100">{tip.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{tip.excerpt}</p>
                      </div>
                      <div className="text-3xl">{tip.image}</div>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                      {tip.read_time} read
                    </p>
                  </div>
                ))}
          </div>
          <Link to="/health-tips" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-amber-200 transition-colors hover:text-amber-100">
            View all health tips <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
