import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Pill } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function PharmacyPage() {
  const [dispensed, setDispensed] = useState<string[]>([]);

  const prescriptions = [
    { id: "med1", name: "Metformin 500mg", dosage: "Take twice daily with meals" },
    { id: "med2", name: "Lisinopril 10mg", dosage: "Take once daily in the morning" },
    { id: "med3", name: "Salbutamol Inhaler", dosage: "Use as needed for shortness of breath" },
  ];

  const toggleDispensed = (id: string) => {
    setDispensed((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const allDispensed = dispensed.length === prescriptions.length;

  return (
    <div className="container py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Prescription for John Smith</span>
            <Link to="/">
              <Button variant="outline" size="sm">Back to Home</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Pill className="mr-2 h-5 w-5" />
              Prescription List
            </h3>

            <div className="space-y-4">
              {prescriptions.map((prescription) => (
                <div key={prescription.id} className="flex items-start space-x-3 p-3 rounded-md border">
                  <Checkbox
                    id={prescription.id}
                    checked={dispensed.includes(prescription.id)}
                    onCheckedChange={() => toggleDispensed(prescription.id)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor={prescription.id}
                      className={`font-medium ${dispensed.includes(prescription.id) ? "line-through text-muted-foreground" : ""}`}
                    >
                      {prescription.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">{prescription.dosage}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button
            className="w-full"
            disabled={allDispensed}
            onClick={() => setDispensed(prescriptions.map((p) => p.id))}
          >
            {allDispensed ? (
              <span className="flex items-center">
                <Check className="mr-2 h-4 w-4" />
                All Medicines Dispensed
              </span>
            ) : (
              "Dispense Medicine"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
