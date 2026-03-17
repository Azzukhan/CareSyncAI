import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { getHealthTips } from "@/lib/api";

export default function HealthTips() {
  const { data: healthTips = [], isLoading } = useQuery({
    queryKey: ["health-tips"],
    queryFn: getHealthTips,
  });

  return (
    <div className="container py-8 md:py-10">
      <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.05),transparent_24%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 shadow-[0_28px_90px_rgba(2,6,23,0.45)] sm:p-10 lg:p-12">
        <Badge className="border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200 hover:bg-cyan-400/10">
          Health tips
        </Badge>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
          NHS-style guidance inside the same CareSync theme
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-400">
          Trusted patient-facing guidance, surfaced in the same dark workspace system used across
          CareSync login, signup, and dashboards.
        </p>
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_16px_40px_rgba(2,6,23,0.18)]"
              >
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-5 h-5 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-14 animate-pulse rounded bg-white/10" />
              </div>
            ))
          : healthTips.map((tip) => (
              <article
                key={tip.id}
                className="rounded-[28px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_16px_40px_rgba(2,6,23,0.18)] transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10">
                    {tip.category}
                  </Badge>
                  <div className="text-3xl">{tip.image}</div>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-100">{tip.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">{tip.excerpt}</p>
                <p className="mt-5 text-xs uppercase tracking-[0.22em] text-slate-500">
                  {tip.read_time} read
                </p>
              </article>
            ))}
      </section>
    </div>
  );
}
