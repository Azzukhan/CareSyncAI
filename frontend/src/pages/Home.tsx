import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-8">
      <h1 className="text-3xl font-bold text-center text-foreground">Healthcare MVP Demo</h1>
      <p className="text-center text-muted-foreground max-w-md">
        This is a demonstration of the healthcare MVP wireframes with QR code interactions between patients and
        healthcare providers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Patient Flow</CardTitle>
            <CardDescription>Registration and dashboard for patients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Start the patient registration process or view the patient dashboard with QR code.</p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link to="/register">
              <Button>Register</Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider Flow</CardTitle>
            <CardDescription>Healthcare provider screens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Access screens for GP, specialist, lab, and pharmacy after scanning QR code.</p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Link to="/scan">
              <Button variant="outline">Scan QR</Button>
            </Link>
            <Link to="/gp-visit">
              <Button variant="outline">GP</Button>
            </Link>
            <Link to="/specialist-visit">
              <Button variant="outline">Specialist</Button>
            </Link>
            <Link to="/lab-test">
              <Button variant="outline">Lab</Button>
            </Link>
            <Link to="/pharmacy">
              <Button variant="outline">Pharmacy</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>GP Verification</CardTitle>
            <CardDescription>For healthcare providers to verify patients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Access the GP verification screen to verify patient details and issue QR codes.</p>
          </CardContent>
          <CardFooter>
            <Link to="/gp-verification">
              <Button variant="outline">GP Verification</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
