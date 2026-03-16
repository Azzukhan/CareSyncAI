import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import ScannableQrPass from "@/components/ScannableQrPass";
import { dashboardRouteForRole, getStoredUser } from "@/lib/api";

export default function SignupSuccess() {
  const user = getStoredUser();
  const dashboardLink = user ? dashboardRouteForRole(user.role) : "/login";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md px-4"
      >
        <Card className="text-center">
          <CardContent className="pt-10 pb-8 space-y-6">
            <div className="h-20 w-20 rounded-full gradient-accent flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Registration Successful!</h1>
              <p className="text-muted-foreground text-sm">
                Your CareSync account has been created and your profile is ready.
              </p>
            </div>
            {user ? (
              <ScannableQrPass
                fullName={user.full_name}
                nhsHealthcareId={user.nhs_healthcare_id}
                qrPayload={user.nhs_healthcare_id}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign in to view and download your CareSync QR pass.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Present this QR code or NHS healthcare ID to CareSync-enabled providers to share
              your live record.
            </p>
            <Link to={dashboardLink}>
              <Button className="w-full gradient-primary border-0 gap-2">
                {user ? "Go to Dashboard" : "Go to Login"} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
