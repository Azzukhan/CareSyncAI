import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, User, Sparkles, Settings, LogOut } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Welcome, John Smith</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="border-2 border-dashed border-muted-foreground p-2 rounded-lg">
              <div className="bg-muted aspect-square w-64 flex items-center justify-center">
                <QrCode className="h-32 w-32 text-primary" />
                <span className="sr-only">Your QR Code</span>
              </div>
            </div>
            <p className="text-center text-muted-foreground">Your QR Code</p>
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/ai-suggestions">
                <User className="mr-2 h-4 w-4" />
                View Personal Info
              </Link>
            </Button>

            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/ai-suggestions">
                <Sparkles className="mr-2 h-4 w-4" />
                AI Suggestions
              </Link>
            </Button>

            <Button variant="outline" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>

            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
