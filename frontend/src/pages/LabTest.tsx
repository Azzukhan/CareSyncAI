import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function LabTestPage() {
  const [results, setResults] = useState("");

  return (
    <div className="container py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Lab Test for John Smith</span>
            <Link to="/">
              <Button variant="outline" size="sm">Back to Home</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Test Request Details</h3>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-foreground">
                <strong>Test Type:</strong> Blood Test - Complete Blood Count, HbA1c, Lipid Panel
              </p>
              <p className="mt-2 text-foreground">
                <strong>Notes:</strong> Patient has Type 2 Diabetes. Please check HbA1c levels and lipid profile.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="results">Result Input</Label>
            <Textarea
              id="results"
              placeholder="Enter test results..."
              className="min-h-[150px]"
              value={results}
              onChange={(e) => setResults(e.target.value)}
            />
          </div>

          <div className="border-2 border-dashed border-muted-foreground rounded-md p-6 flex flex-col items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Upload result file or image</p>
            <Button variant="outline" size="sm" className="mt-2">
              Select File
            </Button>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button className="w-full">Submit Results</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
