import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FlaskConical,
  Heart,
  Lock,
  Pill,
  Shield,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAuthSession,
  dashboardRouteForRole,
  getCurrentUser,
  login,
  storeAuthSession,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const accessPoints = [
  { label: "Patient", icon: UserRound },
  { label: "GP", icon: Stethoscope },
  { label: "Specialist", icon: Shield },
  { label: "Lab", icon: FlaskConical },
  { label: "Pharmacy", icon: Pill },
];

const trustSignals = [
  { value: "1", label: "Secure access layer" },
  { value: "5", label: "Clinical role portals" },
  { value: "24/7", label: "Protected workspace entry" },
];

function safeRedirectPath(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.startsWith("/") ? value : null;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTarget = useMemo(
    () => safeRedirectPath(searchParams.get("redirect")),
    [searchParams],
  );

  const showSupportMessage = () =>
    toast({
      title: "Need access assistance?",
      description:
        "Patient accounts can be created here. Staff access is provisioned by your CareSync administrator.",
    });

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const auth = await login(identifier, password);
      const user = await getCurrentUser(auth.access_token);
      storeAuthSession(auth.access_token, user);
      navigate(redirectTarget ?? dashboardRouteForRole(user.role));
    } catch (error) {
      clearAuthSession();
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Unable to login",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="caresync-workspace-theme dark relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#0a1019_0%,#0c1624_50%,#08111f_100%)] text-slate-100">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="theme-glow-blob absolute left-1/2 top-[16%] h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-[140px]" />
      <div className="theme-glow-blob absolute bottom-[-5rem] left-[16%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[150px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/70 shadow-[0_28px_90px_rgba(2,6,23,0.5)] backdrop-blur-xl lg:grid-cols-[1.04fr_0.96fr]">
          <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.06),transparent_26%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10">
                <Heart className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[0.14em] text-slate-100">CareSync</p>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Unified clinical access
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-md">
              <p
                className="text-5xl leading-[0.92] tracking-tight text-slate-50 sm:text-6xl"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <span className="block">Healthcare</span>
                <span className="block">access intelligence</span>
                <span className="block">
                  that <span className="italic text-amber-300">connects.</span>
                </span>
              </p>
              <p className="mt-6 max-w-sm text-base leading-8 text-slate-400">
                One secure sign-in for patients, GPs, specialists, labs, and pharmacies.
                CareSync routes each verified user into the correct workspace automatically.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-2.5">
              {accessPoints.map((item) => (
                <div
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300"
                >
                  <item.icon className="h-4 w-4 text-amber-300" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-16 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
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
          </section>

          <section className="bg-[linear-gradient(180deg,#101923_0%,#0e1823_100%)] p-8 sm:p-10 lg:p-12">
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Secure Login</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50">
                  Welcome back
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-400">
                  Sign in to your CareSync account to continue. We route you to the
                  correct portal automatically after authentication.
                </p>
                {redirectTarget ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Returning you to your previous workspace after login
                  </div>
                ) : null}
              </div>

              <div className="mt-8 h-px w-12 bg-amber-400/20" />

              <form onSubmit={handleLogin} className="mt-10 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                    Email or NHS ID
                  </label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="email@example.com or NHS-9876543210"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      required
                      className="h-14 rounded-2xl border-white/10 bg-slate-900/80 pl-11 text-base text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-amber-300/40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        toast({
                          title: "Password reset not available yet",
                          description:
                            "Please contact your CareSync administrator for access support.",
                        })
                      }
                      className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300 transition-colors hover:text-amber-200"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="h-14 rounded-2xl border-white/10 bg-slate-900/80 pl-11 pr-12 text-base text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-amber-300/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs leading-6 text-slate-500">
                  Protected by CareSync role-based session controls and secure backend verification.
                </p>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-14 w-full rounded-2xl border-0 bg-[#d3b14d] text-sm font-semibold uppercase tracking-[0.28em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.26)] hover:bg-[#dfc165]"
                >
                  {isSubmitting ? "Signing in..." : "Sign in to CareSync"}
                </Button>
              </form>

              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  New to CareSync?
                </p>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3">
                <Link to="/signup" className="block">
                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-white/10 bg-transparent text-sm font-semibold uppercase tracking-[0.24em] text-amber-200 hover:bg-white/[0.04]"
                  >
                    Create patient account
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  onClick={showSupportMessage}
                  className="h-12 w-full rounded-2xl border-white/10 bg-white/[0.02] text-sm font-semibold uppercase tracking-[0.24em] text-slate-200 hover:bg-white/[0.05]"
                >
                  Need provider access?
                </Button>
                <p className="text-center text-xs text-slate-500">
                  Provider access is provisioned by your CareSync administrator.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-xs text-slate-500">
        © 2026 CareSync • Secure NHS-linked access • Privacy-first authentication
      </div>
    </div>
  );
}
