import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GPVisitPage() {
  const [notes, setNotes] = useState("");

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
            <h3 className="text-lg font-medium mb-2">Current Visit Notes</h3>
            <Textarea
              placeholder="Enter notes for this visit..."
              className="min-h-[120px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Prescriptions</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Metformin 500mg, twice daily</Badge>
              <Badge>Lisinopril 10mg, once daily</Badge>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Issue
          </Button>
          <Button className="flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Prescribe Medicine
          </Button>
          <Button className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Refer to Specialist
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
