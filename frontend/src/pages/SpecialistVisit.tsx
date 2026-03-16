import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Pill, FlaskConical, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SpecialistVisitPage() {
  const [assessment, setAssessment] = useState("");

  return (
    <div className="container py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Patient: John Smith</span>
            <Link to="/">
              <Button variant="outline" size="sm">Back to Home</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Medical History</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Hypertension</Badge>
              <Badge variant="outline">Type 2 Diabetes</Badge>
              <Badge variant="outline">Asthma</Badge>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">GP Notes</h3>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Patient referred for specialist assessment of persistent joint pain in knees and hips. Pain has been
                increasing over the past 6 months. Patient reports difficulty with stairs and prolonged walking. Please
                assess for potential osteoarthritis.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Current Assessment</h3>
            <Textarea
              placeholder="Enter your assessment..."
              className="min-h-[120px]"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
          <Button className="flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Prescribe Medicine
          </Button>
          <Button className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Order Lab Test
          </Button>
          <Button className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Assessment
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
