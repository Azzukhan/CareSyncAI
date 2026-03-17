import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User, Pill, CheckCircle, AlertCircle
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import StaffPortalShell, {
  staffCardClassName,
  staffPrimaryButtonClassName,
  staffSecondaryButtonClassName,
} from "@/components/workspace/StaffPortalShell";
import {
  workspaceAccentSoftBadgeClassName,
  workspaceEyebrowClassName,
  workspaceIconSurfaceClassName,
  workspaceOutlineBadgeClassName,
} from "@/components/workspace/workspaceTheme";
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
    <StaffPortalShell portalLabel="Pharmacy Portal" userName={user?.full_name} onLogout={logout}>
      <div className="space-y-6">
        {!selectedPatient ? (
          <div className={`${staffCardClassName} flex min-h-[60vh] flex-col items-center justify-center space-y-6 rounded-[30px] p-8 text-center`}>
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <Pill className="h-12 w-12" />
            </div>
            <div className="text-center">
              <p className={workspaceEyebrowClassName}>Pharmacy Workspace</p>
              <h1 className="mb-2 mt-2 text-3xl font-bold tracking-tight text-slate-100">Pharmacy Portal</h1>
              <p className="max-w-md text-slate-400">
                Scan a patient QR payload or enter their NHS ID to view live medication orders and update dispensing.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className={staffPrimaryButtonClassName}>
                  <Pill className="h-5 w-5" /> Find Patient
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Button variant="outline" className={staffSecondaryButtonClassName} onClick={() => setSelectedPatient(null)}>← Back</Button>

            {patientQuery.isLoading ? (
              <Card className={staffCardClassName}>
                <CardContent className="pt-6">
                  <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
                </CardContent>
              </Card>
            ) : patientQuery.isError || !patient ? (
              <Card className={staffCardClassName}>
                <CardContent className="pt-6 space-y-4">
                  <p className="font-semibold text-slate-100">Unable to load patient record.</p>
                  <p className="text-sm text-slate-400">
                    {patientQuery.error instanceof Error ? patientQuery.error.message : "Try another patient."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className={staffCardClassName}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl ${workspaceIconSurfaceClassName}`}>
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-100">{patient.full_name}</h2>
                        <p className="text-sm text-slate-400">
                          {patient.nhs_healthcare_id}
                          {patient.date_of_birth ? ` • DOB: ${patient.date_of_birth}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {patient.allergies.map((allergy) => (
                            <Badge key={allergy} className="gap-1 bg-rose-500/10 text-rose-200 hover:bg-rose-500/10">
                              <AlertCircle className="h-3 w-3" />{allergy}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {patient.allergies.length > 0 && (
                  <Card className="border-rose-400/20 bg-rose-500/10 text-rose-100 shadow-[0_18px_45px_rgba(127,29,29,0.14)]">
                    <CardContent className="flex items-start gap-3 pt-4 pb-4">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                      <div>
                        <p className="text-sm font-semibold text-rose-100">Allergy Alert</p>
                        <p className="text-sm text-rose-100/80">
                          Patient allergies: {patient.allergies.join(", ")}. Verify before dispensing.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className={staffCardClassName}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                      <Pill className="h-5 w-5 text-amber-300" /> Prescribed Medications
                      </CardTitle>
                    <p className="text-sm text-slate-400">
                      Review each medication and update the dispensing status after counselling the patient.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {patientMedicationOrders.length === 0 ? (
                      <p className="text-sm text-slate-400">
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
                              isDispensed
                                ? "border-amber-400/20 bg-amber-400/10"
                                : "border-white/10 bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <Pill className="h-4 w-4 text-amber-300" />
                                  <span className="font-semibold text-slate-100">{medication.medicine_name}</span>
                                  <Badge className={isDispensed ? workspaceAccentSoftBadgeClassName : workspaceOutlineBadgeClassName}>
                                    {formatRoleLabel(medication.status)}
                                  </Badge>
                                </div>
                                <div className="space-y-1 pl-6 text-sm">
                                  <p>
                                    <span className="text-slate-500">Dose:</span>{" "}
                                    <span className="font-medium text-slate-200">{medication.dosage_instruction}</span>
                                  </p>
                                  {detail && (
                                    <>
                                      <p>
                                        <span className="text-slate-500">Prescribed by:</span>{" "}
                                        <span className="font-medium text-slate-200">{detail.prescribed_by_name}</span>
                                      </p>
                                      <p>
                                        <span className="text-slate-500">Date:</span>{" "}
                                        <span className="font-medium text-slate-200">{formatDate(detail.created_at)}</span>
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant={isDispensed ? "default" : "outline"}
                                size="sm"
                                className={isDispensed ? staffPrimaryButtonClassName : staffSecondaryButtonClassName}
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
    </StaffPortalShell>
  );
}
