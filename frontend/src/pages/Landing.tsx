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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  { value: "1", label: "Verified identity layer" },
  { value: "5", label: "Connected care roles" },
  { value: "24/7", label: "Protected workspace access" },
  { value: "1", label: "Digital pass across visits" },
];

const careRoles = [
  { label: "Patient", icon: UserRound },
  { label: "GP", icon: Stethoscope },
  { label: "Specialist", icon: ShieldCheck },
  { label: "Lab", icon: FlaskConical },
  { label: "Pharmacy", icon: Pill },
];

const careFlow = [
  {
    title: "One scan, full care context",
    description:
      "Verified providers see the right patient context without re-collecting the same history every time.",
    icon: QrCode,
  },
  {
    title: "Consent-led record sharing",
    description:
      "Patients keep visibility over records while still letting care teams coordinate around the same journey.",
    icon: Lock,
  },
  {
    title: "Faster referral coordination",
    description:
      "GPs, specialists, labs, and pharmacies stay aligned on one connected care trail.",
    icon: Users,
  },
];

const journeySteps = [
  {
    step: "01",
    title: "Register once",
    description: "Create one patient account with your NHS-linked identity.",
  },
  {
    step: "02",
    title: "Use your digital health card",
    description: "Present one QR pass whenever CareSync-enabled care begins.",
  },
  {
    step: "03",
    title: "Keep the journey connected",
    description: "Visits, labs, medicines, and referrals stay visible across the same path.",
  },
];

const benefitCards = [
  {
    icon: Clock3,
    title: "Reduce repeat history collection",
    description: "Providers start with context instead of asking the same intake questions again.",
  },
  {
    icon: HeartPulse,
    title: "Keep records in sync",
    description: "Visits, reports, medicines, and AI-supported plans stay connected in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Keep access controlled",
    description: "Patient privacy and consent remain visible across the full workflow.",
  },
  {
    icon: Users,
    title: "Keep teams aligned",
    description: "GP, specialist, lab, and pharmacy roles can work from the same care trail.",
  },
];

export default function Landing() {
  const { data: healthTips = [], isLoading } = useQuery({
    queryKey: ["health-tips"],
    queryFn: getHealthTips,
  });

  return (
    <div className="relative overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[48rem] bg-[radial-gradient(circle_at_18%_16%,rgba(211,177,77,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(34,211,238,0.13),transparent_26%),linear-gradient(180deg,rgba(10,16,25,0),rgba(10,16,25,0.72))]" />

      <section className="relative border-b border-white/8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1520px] flex-col justify-between px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-14">
          <div className="grid flex-1 items-center gap-12 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 xl:gap-20">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="max-w-3xl"
            >
              <Badge className="border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-amber-200 hover:bg-amber-400/10">
                NHS-linked unified clinical access
              </Badge>

              <div className="mt-8">
                <p
                  className="text-5xl leading-[0.92] tracking-tight text-slate-50 sm:text-6xl xl:text-7xl"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  <span className="block">Healthcare access</span>
                  <span className="block">that stays connected,</span>
                  <span className="block">
                    calm, and <span className="italic text-amber-300">clear.</span>
                  </span>
                </p>
                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                  CareSync gives patients and care teams one secure access layer for digital
                  health cards, records, referrals, dashboards, and consent-aware clinical
                  coordination.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                {careRoles.map((role) => (
                  <div
                    key={role.label}
                    className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 shadow-[0_10px_30px_rgba(2,6,23,0.12)]"
                  >
                    <role.icon className="h-4 w-4 text-amber-300" />
                    <span>{role.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link to="/signup">
                  <Button className="h-12 border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.24)] hover:bg-[#dfc165]">
                    Create patient account
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="h-12 border-white/10 bg-white/[0.03] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-100 hover:bg-white/[0.06]"
                  >
                    Enter workspace
                  </Button>
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                >
                  See how CareSync works
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="border border-white/10 bg-[linear-gradient(180deg,rgba(17,22,31,0.95),rgba(9,19,28,0.88))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.3)] sm:p-7 lg:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                    Connected care flow
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
                    One system, one journey
                  </p>
                </div>
                <div className="border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs uppercase tracking-[0.24em] text-cyan-200">
                  Live workspace path
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {careFlow.map((item, index) => (
                  <motion.div
                    key={item.title}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    className="border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center border border-cyan-400/20 bg-cyan-400/10">
                      <item.icon className="h-5 w-5 text-cyan-200" />
                    </div>
                    <p className="mt-4 text-lg font-semibold leading-7 text-slate-100">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{item.description}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 border border-white/10 bg-slate-950/45 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Patient journey</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {journeySteps.map((item) => (
                    <div key={item.step} className="border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex h-10 w-10 items-center justify-center border border-amber-300/20 bg-amber-300/10 text-sm font-semibold text-amber-200">
                        {item.step}
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2 xl:grid-cols-4">
            {trustSignals.map((signal) => (
              <div key={signal.label} className="border border-white/8 bg-white/[0.025] p-4">
                <p className="text-4xl font-semibold text-amber-300">{signal.value}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {signal.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-b border-white/8 py-20 lg:py-24">
        <div className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-10 xl:px-14">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Why CareSync</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
                A landing page that explains one healthcare journey, not five disconnected screens
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
                CareSync works when the experience is simple: identity, access, records,
                coordination, and patient visibility all stay in one continuous flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/signup">
                <Button className="h-11 border-0 bg-[#d3b14d] px-5 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 hover:bg-[#dfc165]">
                  Start with signup
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  className="h-11 border-white/10 bg-white/[0.03] px-5 text-sm font-semibold uppercase tracking-[0.22em] text-slate-100 hover:bg-white/[0.06]"
                >
                  Existing users log in
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {benefitCards.map((item, index) => (
              <motion.div
                key={item.title}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="border border-white/10 bg-[linear-gradient(180deg,rgba(17,22,31,0.86),rgba(10,18,28,0.76))] p-6 shadow-[0_18px_44px_rgba(2,6,23,0.18)]"
              >
                <div className="flex h-11 w-11 items-center justify-center border border-amber-300/20 bg-amber-300/10">
                  <item.icon className="h-5 w-5 text-amber-300" />
                </div>
                <p className="mt-5 text-xl font-semibold leading-8 text-slate-100">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 lg:py-24">
        <div className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-10 xl:px-14">
          <div className="border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(211,177,77,0.12),transparent_24%),linear-gradient(180deg,rgba(17,22,31,0.94),rgba(9,19,28,0.88))] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Ready to start</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
                  Move from disconnected admin steps to one continuous care flow
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
                  Patients create one account, receive one digital health card, and enter one
                  protected workspace that can be used across visits, reports, medicines, and
                  follow-up care.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link to="/signup">
                    <Button className="h-12 border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.24)] hover:bg-[#dfc165]">
                      Start patient signup
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      variant="outline"
                      className="h-12 border-white/10 bg-white/[0.03] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-100 hover:bg-white/[0.06]"
                    >
                      Log in to CareSync
                    </Button>
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Latest guidance</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="border border-white/10 bg-white/[0.03] p-5">
                          <div className="h-4 w-24 animate-pulse bg-white/10" />
                          <div className="mt-4 h-6 w-3/4 animate-pulse bg-white/10" />
                          <div className="mt-3 h-12 animate-pulse bg-white/10" />
                        </div>
                      ))
                    : healthTips.slice(0, 3).map((tip) => (
                        <div
                          key={tip.id}
                          className="border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                              {tip.category}
                            </Badge>
                            <div className="text-2xl">{tip.image}</div>
                          </div>
                          <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-100">
                            {tip.title}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-slate-400">{tip.excerpt}</p>
                          <p className="mt-5 text-xs uppercase tracking-[0.22em] text-slate-500">
                            {tip.read_time} read
                          </p>
                        </div>
                      ))}
                </div>
                <Link
                  to="/health-tips"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-amber-200 transition-colors hover:text-amber-100"
                >
                  View all health tips <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
