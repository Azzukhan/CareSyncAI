import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart, LogOut, User, Pill, CheckCircle, AlertCircle
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import { useToast } from "@/hooks/use-toast";
import { dispenseMedication, getPatientDashboard, listPharmacyMedications } from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatRoleLabel } from "@/lib/utils";

export default function PharmacyDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("pharmacy");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const medicationsQuery = useQuery({
    queryKey: ["pharmacy-medications"],
    queryFn: () => listPharmacyMedications(token!),
    enabled: isAuthenticated && Boolean(token),
  });

  const patientQuery = useQuery({
    queryKey: ["pharmacy-patient-dashboard", selectedPatient],
    queryFn: () => getPatientDashboard(token!, selectedPatient!),
    enabled: isAuthenticated && Boolean(token) && Boolean(selectedPatient),
  });

  const dispenseMutation = useMutation({
    mutationFn: (medicationId: string) => dispenseMedication(token!, medicationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pharmacy-medications"] }),
        queryClient.invalidateQueries({ queryKey: ["pharmacy-patient-dashboard", selectedPatient] }),
      ]);
      toast({ title: "Medication dispensed", description: "Dispensing status has been updated." });
    },
    onError: (error) => {
      toast({
        title: "Unable to mark medication as dispensed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return null;
  }

  const patient = patientQuery.data?.patient;
  const patientMedicationOrders = patient && medicationsQuery.data
    ? medicationsQuery.data.items.filter((medication) => medication.patient_user_id === patient.user_id)
    : [];
  const medicationDetails = patientQuery.data?.medications ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">CareSync</span>
            <Badge variant="secondary" className="ml-2">Pharmacy Portal</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name}</span>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6 space-y-6">
        {!selectedPatient ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <div className="h-24 w-24 rounded-3xl gradient-primary flex items-center justify-center">
              <Pill className="h-12 w-12 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Pharmacy Portal</h1>
              <p className="text-muted-foreground max-w-md">
                Scan a patient QR payload or enter their NHS ID to view live medication orders and update dispensing.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className="gradient-primary border-0 gap-2">
                  <Pill className="h-5 w-5" /> Find Patient
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setSelectedPatient(null)}>← Back</Button>

            {patientQuery.isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="h-24 rounded bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ) : patientQuery.isError || !patient ? (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="font-semibold">Unable to load patient record.</p>
                  <p className="text-sm text-muted-foreground">
                    {patientQuery.error instanceof Error ? patientQuery.error.message : "Try another patient."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
                        <User className="h-7 w-7 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{patient.full_name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {patient.nhs_healthcare_id}
                          {patient.date_of_birth ? ` • DOB: ${patient.date_of_birth}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {patient.allergies.map((allergy) => (
                            <Badge key={allergy} variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />{allergy}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {patient.allergies.length > 0 && (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="pt-4 pb-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm text-destructive">Allergy Alert</p>
                        <p className="text-sm text-muted-foreground">
                          Patient allergies: {patient.allergies.join(", ")}. Verify before dispensing.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pill className="h-5 w-5 text-primary" /> Prescribed Medications
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Review each medication and update the dispensing status after counselling the patient.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {patientMedicationOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No pharmacy medication orders are available for this patient yet.
                      </p>
                    ) : (
                      patientMedicationOrders.map((medication) => {
                        const detail = medicationDetails.find((item) => item.id === medication.id);
                        const isDispensed = medication.status === "dispensed";

                        return (
                          <div
                            key={medication.id}
                            className={`p-4 rounded-lg border transition-all ${
                              isDispensed ? "bg-accent/5 border-accent/30" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <Pill className="h-4 w-4 text-primary" />
                                  <span className="font-semibold">{medication.medicine_name}</span>
                                  <Badge variant={isDispensed ? "secondary" : "outline"}>
                                    {formatRoleLabel(medication.status)}
                                  </Badge>
                                </div>
                                <div className="space-y-1 text-sm pl-6">
                                  <p>
                                    <span className="text-muted-foreground">Dose:</span>{" "}
                                    <span className="font-medium">{medication.dosage_instruction}</span>
                                  </p>
                                  {detail && (
                                    <>
                                      <p>
                                        <span className="text-muted-foreground">Prescribed by:</span>{" "}
                                        <span className="font-medium">{detail.prescribed_by_name}</span>
                                      </p>
                                      <p>
                                        <span className="text-muted-foreground">Date:</span>{" "}
                                        <span className="font-medium">{formatDate(detail.created_at)}</span>
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant={isDispensed ? "default" : "outline"}
                                size="sm"
                                className={isDispensed ? "gradient-accent border-0 text-accent-foreground" : ""}
                                onClick={() => dispenseMutation.mutate(medication.id)}
                                disabled={isDispensed || dispenseMutation.isPending}
                              >
                                {isDispensed ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" /> Dispensed
                                  </>
                                ) : (
                                  "Mark Dispensed"
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
