import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function GPVerificationPage() {
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    setVerified(true);
    setTimeout(() => {
      navigate("/");
    }, 3000);
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Patient Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Patient verified. QR code has been sent to the patient.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Name</Label>
            <Input defaultValue="John Smith" readOnly />
          </div>

          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input defaultValue="15/05/1985" readOnly />
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Input defaultValue="123 Main Street, London" readOnly />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue="john.smith@example.com" readOnly />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input defaultValue="07700 900123" readOnly />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button className="w-full" onClick={handleVerify} disabled={verified}>
            {verified ? "Verified & QR Code Sent" : "Verify & Send QR Code"}
          </Button>
          <Button variant="outline" className="w-full" disabled={verified}>
            Edit Details
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
