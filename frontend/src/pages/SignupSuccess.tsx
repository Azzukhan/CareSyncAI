import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import ScannableQrPass from "@/components/ScannableQrPass";
import { dashboardRouteForRole, getStoredUser } from "@/lib/api";

export default function SignupSuccess() {
  const user = getStoredUser();
  const dashboardLink = user ? dashboardRouteForRole(user.role) : "/login";

  return (
    <div className="container py-8 md:py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/55 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.14),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.05),transparent_24%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10">
            <CheckCircle2 className="h-7 w-7 text-amber-300" />
          </div>
          <p className="mt-8 text-xs uppercase tracking-[0.28em] text-slate-500">Patient onboarding complete</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50">
            Your CareSync account is ready
          </h1>
          <p className="mt-4 max-w-md text-base leading-8 text-slate-400">
            Your patient workspace has been created and your digital health card can now be used
            across CareSync-enabled care journeys.
          </p>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-slate-100">What happens next</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <li>Use your dashboard to review profile, history, and AI-supported care tools.</li>
              <li>Present your digital health card when a provider needs CareSync-linked access.</li>
              <li>Manage privacy settings directly from your patient workspace.</li>
            </ul>
          </div>

          <Link to={dashboardLink} className="mt-8 block">
            <Button className="h-12 rounded-2xl border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.24)] hover:bg-[#dfc165]">
              {user ? "Go to dashboard" : "Go to login"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>

        <section className="bg-[linear-gradient(180deg,#101923_0%,#0e1823_100%)] p-8 sm:p-10 lg:p-12">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_16px_40px_rgba(2,6,23,0.18)]">
            {user ? (
              <ScannableQrPass
                fullName={user.full_name}
                nhsHealthcareId={user.nhs_healthcare_id}
                qrPayload={user.nhs_healthcare_id}
              />
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-8 text-center">
                <p className="text-sm leading-7 text-slate-400">
                  Sign in to view and download your CareSync digital health card.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
