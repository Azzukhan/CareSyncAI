import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Stethoscope, Shield, FlaskConical, Pill, Users } from "lucide-react";
import {
  clearAuthSession,
  dashboardRouteForRole,
  getCurrentUser,
  login,
  storeAuthSession,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const roles = [
  { id: "patient", label: "Patient", icon: Users, route: "/dashboard/patient" },
  { id: "gp", label: "GP", icon: Stethoscope, route: "/dashboard/gp" },
  { id: "specialist", label: "Specialist", icon: Shield, route: "/dashboard/specialist" },
  { id: "lab", label: "Lab", icon: FlaskConical, route: "/dashboard/lab" },
  { id: "pharmacy", label: "Pharmacy", icon: Pill, route: "/dashboard/pharmacy" },
];

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState("patient");
  const [nhsId, setNhsId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const auth = await login(nhsId, password);
      const user = await getCurrentUser(auth.access_token);

      if (user.role !== selectedRole) {
        clearAuthSession();
        toast({
          title: "Role mismatch",
          description: `This account is '${user.role}'. Select the correct role and try again.`,
          variant: "destructive",
        });
        return;
      }

      storeAuthSession(auth.access_token, user);
      navigate(dashboardRouteForRole(user.role));
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back to CareSync</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to access your portal</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Select your role</CardTitle>
            <CardDescription>Choose how you want to sign in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-medium
                    ${selectedRole === role.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                    }`}
                >
                  <role.icon className="h-5 w-5" />
                  {role.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email or NHS Healthcare ID</Label>
                <Input
                  placeholder="e.g. NHS-9876543210 or doctor@nhs.uk"
                  value={nhsId}
                  onChange={(e) => setNhsId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password</Label>
                  <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
                </div>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-primary border-0" disabled={isSubmitting}>
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Patient? Don't have an account?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">Register here</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
