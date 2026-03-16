import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Heart, CheckCircle } from "lucide-react";
import {
  getCurrentUser,
  login,
  registerPatient,
  storeAuthSession,
  updatePatientProfile,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Register for CareSync</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create your patient account to receive your NHS QR code
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((currentStep) => (
            <div key={currentStep} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step > currentStep
                    ? "gradient-accent text-accent-foreground"
                    : step === currentStep
                      ? "gradient-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > currentStep ? <CheckCircle className="h-4 w-4" /> : currentStep}
              </div>
              {currentStep < 3 && (
                <div className={`w-12 h-0.5 ${step > currentStep ? "bg-accent" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">NHS Details</CardTitle>
                  <CardDescription>Enter your NHS healthcare identification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>NHS Healthcare ID *</Label>
                    <Input
                      placeholder="e.g. NHS-9876543210"
                      value={nhsHealthcareId}
                      onChange={(e) => setNhsHealthcareId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input
                        placeholder="Sarah"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input
                        placeholder="Johnson"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">Contact & Medical Info</CardTitle>
                  <CardDescription>
                    These details are saved directly to your CareSync profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="sarah@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      placeholder="07700 123456"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address *</Label>
                    <Input
                      placeholder="42 Kensington Road"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode *</Label>
                    <Input
                      placeholder="SW7 4QJ"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      required
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Blood Type</Label>
                    <Select value={bloodType} onValueChange={setBloodType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Known Allergies</Label>
                    <Input
                      placeholder="e.g. Penicillin, Shellfish"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chronic Conditions</Label>
                    <Input
                      placeholder="e.g. Asthma, Diabetes"
                      value={chronicConditions}
                      onChange={(e) => setChronicConditions(e.target.value)}
                    />
                  </div>
                </CardContent>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeader>
                  <CardTitle className="text-lg">Create Login Credentials</CardTitle>
                  <CardDescription>Set up your password to secure your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum 8 characters with at least one number and one special character.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-start gap-2 p-4 rounded-lg bg-muted/50">
                    <input type="checkbox" id="terms" className="mt-1" required />
                    <label htmlFor="terms" className="text-xs text-muted-foreground">
                      I agree to CareSync&apos;s Terms of Service and Privacy Policy. I understand
                      my medical records will be securely stored and shared only with my explicit
                      consent.
                    </label>
                  </div>
                </CardContent>
              </>
            )}

            <CardFooter className="flex justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button type="submit" className="gradient-primary border-0" disabled={isSubmitting}>
                {step === 3 ? (isSubmitting ? "Creating..." : "Create Account") : "Continue"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
