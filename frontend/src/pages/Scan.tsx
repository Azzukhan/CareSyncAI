import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function ScanPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);

  const handleScan = () => {
    setScanning(false);
    setTimeout(() => {
      navigate("/gp-visit");
    }, 1500);
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Scan Patient QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="aspect-video bg-muted rounded-lg border border-dashed border-muted-foreground flex items-center justify-center cursor-pointer"
            onClick={handleScan}
          >
            {scanning ? (
              <div className="text-center p-4">
                <p className="text-muted-foreground">Camera viewport</p>
                <p className="text-xs text-muted-foreground mt-2">(Click to simulate scan)</p>
              </div>
            ) : (
              <p className="text-primary font-medium">QR Code detected!</p>
            )}
          </div>

          <p className="text-center text-muted-foreground">
            Please scan the patient's QR code to access their records.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload QR Code Image
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
