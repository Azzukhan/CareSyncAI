import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  getCurrentUser,
  login,
  registerPatient,
  storeAuthSession,
  updatePatientProfile,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const stepContent = [
  {
    step: 1,
    label: "Identity",
    title: "Verify your NHS-linked identity",
    description:
      "Use the patient details that should appear on your CareSync record and digital health card.",
  },
  {
    step: 2,
    label: "Profile",
    title: "Complete your patient profile",
    description:
      "Add the contact and medical details that help populate your dashboard and care history.",
  },
  {
    step: 3,
    label: "Security",
    title: "Secure your CareSync account",
    description:
      "Set your password and confirm your consent so you can finish onboarding safely.",
  },
] as const;

const trustSignals = [
  { value: "3", label: "Guided onboarding steps" },
  { value: "QR", label: "Health pass generated" },
  { value: "Private", label: "Consent-led access" },
];

const authInputClassName =
  "h-12 rounded-2xl border-white/10 bg-slate-900/80 text-base text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-amber-300/40";

export default function PatientSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nhsHealthcareId, setNhsHealthcareId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const currentStep = stepContent[step - 1];
  const progressWidth = `${(step / stepContent.length) * 100}%`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (step < stepContent.length) {
      setStep((current) => current + 1);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Password and confirm password must match.",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Consent required",
        description: "Please accept the privacy and consent terms before creating your account.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await registerPatient({
        nhsHealthcareId,
        fullName: `${firstName} ${lastName}`.trim(),
        email,
        password,
      });
    } catch (error) {
      toast({
        title: "Signup failed",
        description: error instanceof Error ? error.message : "Unable to create account",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const auth = await login(nhsHealthcareId, password);
      const user = await getCurrentUser(auth.access_token);
      storeAuthSession(auth.access_token, user);

      await updatePatientProfile(auth.access_token, {
        dateOfBirth,
        phoneNumber,
        address: [address.trim(), postcode.trim()].filter(Boolean).join(", "),
        bloodGroup: bloodType || undefined,
        allergies: allergies || undefined,
        chronicConditions: chronicConditions || undefined,
      });

      navigate("/signup/success");
    } catch (error) {
      toast({
        title: "Account created",
        description:
          error instanceof Error
            ? `Your account was created, but profile setup was incomplete: ${error.message}`
            : "Your account was created. Please sign in to finish setting up your profile.",
      });
      navigate("/login");
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
      <div className="theme-glow-blob absolute right-[12%] top-[12%] h-72 w-72 rounded-full bg-amber-400/10 blur-[140px]" />
      <div className="theme-glow-blob absolute bottom-[-4rem] left-[12%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[150px]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/70 shadow-[0_28px_90px_rgba(2,6,23,0.5)] backdrop-blur-xl md:grid-cols-[0.92fr_1.08fr]">
          <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_34%),linear-gradient(180deg,rgba(245,158,11,0.06),transparent_26%),linear-gradient(180deg,#11161f_0%,#09131c_100%)] p-8 sm:p-10 md:border-b-0 md:border-r lg:p-12">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10">
                <Heart className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[0.14em] text-slate-100">CareSync</p>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Patient onboarding
                </p>
              </div>
            </div>

            <div className="mt-12 max-w-md">
              <p
                className="text-5xl leading-[0.92] tracking-tight text-slate-50 sm:text-6xl"
                style={{ fontFamily: "Georgia, serif" }}
              >
                <span className="block">Patient access</span>
                <span className="block">that opens</span>
                <span className="block">
                  cleanly and <span className="italic text-amber-300">securely.</span>
                </span>
              </p>
              <p className="mt-6 max-w-sm text-base leading-8 text-slate-400">
                Create your CareSync patient account for dashboard access, your digital health
                card, and consent-led record sharing.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Patients self-register here</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Complete onboarding in three short steps and get signed in automatically.
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                    Staff teams sign in through `/login`
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
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
              P
            </div>
          </section>

          <section className="bg-[linear-gradient(180deg,#101923_0%,#0e1823_100%)] p-8 sm:p-10 lg:p-12">
            <div className="mx-auto flex h-full max-w-md flex-col justify-start pt-2">
              <div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50">
                  Create patient account
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-400">
                  Three short steps to create your CareSync patient account.
                </p>
              </div>

              <div className="mt-8 h-px w-12 bg-amber-400/20" />

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Step {currentStep.step} of {stepContent.length} • {currentStep.label}
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  <span>Onboarding progress</span>
                  <span>{Math.round((step / stepContent.length) * 100)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#d3b14d_100%)] transition-all duration-300"
                    style={{ width: progressWidth }}
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {stepContent.map((item, index) => (
                    <div key={item.step} className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                          step > item.step
                            ? "border-amber-300/30 bg-amber-300/15 text-amber-200"
                            : step === item.step
                              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                              : "border-white/10 bg-white/[0.03] text-slate-500"
                        }`}
                      >
                        {step > item.step ? <CheckCircle2 className="h-4 w-4" /> : item.step}
                      </div>
                      {index < stepContent.length - 1 ? <div className="h-px w-10 bg-white/10" /> : null}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(2,6,23,0.18)]">
                  <div className="mb-4">
                    <p className="text-lg font-semibold text-slate-100">{currentStep.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{currentStep.description}</p>
                  </div>

                  {step === 1 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          NHS Healthcare ID
                        </Label>
                        <div className="relative">
                          <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            placeholder="e.g. NHS-9876543210"
                            value={nhsHealthcareId}
                            onChange={(event) => setNhsHealthcareId(event.target.value)}
                            required
                            className={`${authInputClassName} pl-11`}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            First name
                          </Label>
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              placeholder="Sarah"
                              value={firstName}
                              onChange={(event) => setFirstName(event.target.value)}
                              required
                              className={`${authInputClassName} pl-11`}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            Last name
                          </Label>
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              placeholder="Johnson"
                              value={lastName}
                              onChange={(event) => setLastName(event.target.value)}
                              required
                              className={`${authInputClassName} pl-11`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Date of birth
                        </Label>
                        <Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} required className={authInputClassName} />
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm leading-6 text-slate-400">
                        Use the NHS identifier and legal name you expect to see on your digital
                        health card.
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            type="email"
                            placeholder="sarah@email.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            className={`${authInputClassName} pl-11`}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Phone number
                        </Label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            type="tel"
                            placeholder="07700 123456"
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(event.target.value)}
                            required
                            className={`${authInputClassName} pl-11`}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            Address
                          </Label>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                              placeholder="42 Kensington Road"
                              value={address}
                              onChange={(event) => setAddress(event.target.value)}
                              required
                              className={`${authInputClassName} pl-11`}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            Postcode
                          </Label>
                          <Input
                            placeholder="SW7 4QJ"
                            value={postcode}
                            onChange={(event) => setPostcode(event.target.value)}
                            required
                            className={authInputClassName}
                          />
                        </div>
                      </div>

                      <Separator className="bg-white/10" />

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            Blood type
                          </Label>
                          <Select value={bloodType} onValueChange={setBloodType}>
                            <SelectTrigger className={authInputClassName}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            Known allergies
                          </Label>
                          <Input
                            placeholder="e.g. Penicillin, Shellfish"
                            value={allergies}
                            onChange={(event) => setAllergies(event.target.value)}
                            className={authInputClassName}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Chronic conditions
                        </Label>
                        <Input
                          placeholder="e.g. Asthma, Diabetes"
                          value={chronicConditions}
                          onChange={(event) => setChronicConditions(event.target.value)}
                          className={authInputClassName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Password
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            className={`${authInputClassName} pl-11 pr-12`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs leading-6 text-slate-500">
                          Minimum 8 characters. Use a password you do not reuse elsewhere.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                          Confirm password
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            required
                            className={`${authInputClassName} pl-11 pr-12`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm leading-6 text-slate-400">
                        After signup, you will be signed in automatically and taken to your
                        patient workspace to finish setup.
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(event) => setTermsAccepted(event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950"
                          required
                        />
                        <span>
                          I agree to CareSync&apos;s Terms of Service and Privacy Policy. I
                          understand my medical records are stored securely and shared only through
                          approved CareSync access controls.
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  {step > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep((current) => current - 1)}
                      className="h-12 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-slate-100 hover:bg-white/[0.06]"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  <Button
                    type="submit"
                    className="h-12 rounded-2xl border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_40px_rgba(211,177,77,0.24)] hover:bg-[#dfc165]"
                    disabled={isSubmitting}
                  >
                    {step === stepContent.length
                      ? isSubmitting
                        ? "Creating..."
                        : "Create account"
                      : "Continue"}
                    {step < stepContent.length ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
                  </Button>
                </div>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  Already registered?
                </p>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3">
                <Link to="/login" className="block">
                  <Button
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-white/10 bg-transparent text-sm font-semibold uppercase tracking-[0.24em] text-amber-200 hover:bg-white/[0.04]"
                  >
                    Sign in to CareSync
                  </Button>
                </Link>
                <p className="text-center text-xs leading-6 text-slate-500">
                  GP, specialist, lab, and pharmacy users sign in through `/login`.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-xs text-slate-500">
        © 2026 CareSync • Patient onboarding • Secure NHS-linked registration
      </div>
    </div>
  );
}
