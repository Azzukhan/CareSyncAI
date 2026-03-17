import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User, Users, Stethoscope, Clock,
  FileText, Pill, FlaskConical, Send, Plus, CheckCircle,
  ChevronRight, AlertCircle
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import StaffPortalShell, {
  staffCardClassName,
  staffInputClassName,
  staffMutedCardClassName,
  staffPrimaryButtonClassName,
  staffSecondaryButtonClassName,
  staffTabListClassName,
  staffTabTriggerClassName,
  staffTextareaClassName,
} from "@/components/workspace/StaffPortalShell";
import { workspaceIconSurfaceClassName } from "@/components/workspace/workspaceTheme";
import { useToast } from "@/hooks/use-toast";
import {
  createGpLabOrder,
  createGpMedication,
  createGpSpecialistReferral,
  createGpVisit,
  getGpDashboard,
  getPatientDashboard,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatRoleLabel } from "@/lib/utils";

type ReferralType = "specialist" | "lab" | null;

function visitLabel(recordType: string, providerRole: string): string {
  if (recordType === "gp_visit") {
    return "GP Visit";
  }
  if (recordType === "specialist_note") {
    return "Specialist Note";
  }
  if (recordType === "specialist_referral") {
    return "Specialist Referral";
  }
  return formatRoleLabel(providerRole);
}

export default function GPDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("gp");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [referralType, setReferralType] = useState<ReferralType>(null);
  const [referralNotes, setReferralNotes] = useState("");
  const [newMedName, setNewMedName] = useState("");
  const [newMedDose, setNewMedDose] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["gp-dashboard"],
    queryFn: () => getGpDashboard(token!),
    enabled: isAuthenticated && Boolean(token),
  });

  const patientQuery = useQuery({
    queryKey: ["gp-patient-dashboard", selectedPatient],
    queryFn: () => getPatientDashboard(token!, selectedPatient!),
    enabled: isAuthenticated && Boolean(token) && Boolean(selectedPatient),
  });

  const refreshSelectedPatient = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gp-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["gp-patient-dashboard", selectedPatient] }),
    ]);
  };

  const saveVisitMutation = useMutation({
    mutationFn: () => createGpVisit(token!, {
      patientNhsHealthcareId: selectedPatient!,
      notes,
    }),
    onSuccess: async () => {
      setNotes("");
      await refreshSelectedPatient();
      toast({ title: "Visit saved", description: "The patient history has been updated." });
    },
    onError: (error) => {
      toast({
        title: "Unable to save visit",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const referralMutation = useMutation({
    mutationFn: async () => {
      if (referralType === "specialist") {
        await createGpSpecialistReferral(token!, {
          patientNhsHealthcareId: selectedPatient!,
          specialistNotes: referralNotes,
        });
        return;
      }

      if (referralType === "lab") {
        await createGpLabOrder(token!, {
          patientNhsHealthcareId: selectedPatient!,
          testDescription: referralNotes,
        });
      }
    },
    onSuccess: async () => {
      setReferralNotes("");
      await refreshSelectedPatient();
      toast({ title: "Referral sent", description: "The request has been submitted." });
    },
    onError: (error) => {
      toast({
        title: "Unable to submit referral",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const medicationMutation = useMutation({
    mutationFn: () => createGpMedication(token!, {
      patientNhsHealthcareId: selectedPatient!,
      medicineName: newMedName,
      dosageInstruction: newMedDose,
    }),
    onSuccess: async () => {
      setNewMedName("");
      setNewMedDose("");
      await refreshSelectedPatient();
      toast({
        title: "Medication added",
        description: "The prescription is now available to pharmacy staff.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to add medication",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <StaffPortalShell portalLabel="GP Portal" userName={user?.full_name} onLogout={logout}>
      <div className="space-y-6">
        {!selectedPatient ? (
          <>
            <div className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-slate-950/45 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.26)] md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">GP Workspace</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">
                  Good Morning, {user?.full_name?.split(" ")[0] ?? "Doctor"}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <QRScannerModal
                onPatientFound={setSelectedPatient}
                trigger={
                  <Button size="lg" className={staffPrimaryButtonClassName}>
                    <Stethoscope className="mr-2 h-5 w-5" />
                    Find Patient
                  </Button>
                }
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Today's Patients",
                  value: summaryQuery.data?.todays_patient_count ?? 0,
                  icon: Users,
                },
                {
                  label: "Today's Visits",
                  value: summaryQuery.data?.todays_visits ?? 0,
                  icon: CheckCircle,
                },
                {
                  label: "Recent Patients",
                  value: summaryQuery.data?.recent_patients.length ?? 0,
                  icon: Clock,
                },
                {
                  label: "Last Refresh",
                  value: summaryQuery.data ? formatDate(summaryQuery.data.generated_at) : "N/A",
                  icon: AlertCircle,
                },
              ].map((summary) => (
                <Card key={summary.label} className={staffCardClassName}>
                  <CardContent className="flex items-center gap-3 pt-4 pb-4">
                    <div className={`flex h-12 w-12 items-center justify-center ${workspaceIconSurfaceClassName}`}>
                      <summary.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-100">{summary.value}</p>
                      <p className="text-xs text-slate-400">{summary.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className={staffCardClassName}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                  <Users className="h-5 w-5 text-amber-300" /> Recent Patient Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
                    ))}
                  </div>
                ) : summaryQuery.data?.recent_patients.length ? (
                  <div className="space-y-2">
                    {summaryQuery.data.recent_patients.map((patient) => (
                      <button
                        key={patient.nhs_healthcare_id}
                        onClick={() => setSelectedPatient(patient.nhs_healthcare_id)}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-100">{patient.full_name}</p>
                            <p className="text-xs text-slate-400">
                              {patient.nhs_healthcare_id} • Last visit {formatDateTime(patient.last_visit_at)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No GP visits have been logged for this account yet. Use the QR lookup to open a patient record.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className={staffSecondaryButtonClassName}
                onClick={() => {
                  setSelectedPatient(null);
                  setReferralType(null);
                  setReferralNotes("");
                  setNotes("");
                  setNewMedName("");
                  setNewMedDose("");
                }}
              >
                ← Back to Overview
              </Button>
            </div>

            {patientQuery.isLoading ? (
              <Card className={staffCardClassName}>
                <CardContent className="pt-6">
                  <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse" />
                </CardContent>
              </Card>
            ) : patientQuery.isError || !patientQuery.data ? (
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
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                        <User className="h-7 w-7" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-100">{patientQuery.data.patient.full_name}</h2>
                        <p className="text-sm text-slate-400">
                          {patientQuery.data.patient.nhs_healthcare_id}
                          {patientQuery.data.patient.date_of_birth
                            ? ` • DOB: ${patientQuery.data.patient.date_of_birth}`
                            : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {patientQuery.data.patient.blood_group && (
                            <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">
                              Blood: {patientQuery.data.patient.blood_group}
                            </Badge>
                          )}
                          {patientQuery.data.patient.allergies.map((allergy) => (
                            <Badge key={allergy} className="gap-1 bg-rose-500/10 text-rose-200 hover:bg-rose-500/10">
                              <AlertCircle className="h-3 w-3" /> {allergy}
                            </Badge>
                          ))}
                          {patientQuery.data.patient.chronic_conditions.map((condition) => (
                            <Badge key={condition} variant="outline" className="border-white/10 text-slate-300">{condition}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="history">
                  <TabsList className={staffTabListClassName}>
                    <TabsTrigger value="history" className={staffTabTriggerClassName}>
                      <FileText className="h-3 w-3" /> History
                    </TabsTrigger>
                    <TabsTrigger value="notes" className={staffTabTriggerClassName}>
                      <Stethoscope className="h-3 w-3" /> Visit Notes
                    </TabsTrigger>
                    <TabsTrigger value="refer" className={staffTabTriggerClassName}>
                      <Send className="h-3 w-3" /> Refer
                    </TabsTrigger>
                    <TabsTrigger value="prescribe" className={staffTabTriggerClassName}>
                      <Pill className="h-3 w-3" /> Prescribe
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="space-y-3 mt-4">
                    {patientQuery.data.visits.length === 0 ? (
                      <Card className={staffCardClassName}>
                        <CardContent className="pt-6 text-sm text-slate-400">
                          No visible history is available for this patient.
                        </CardContent>
                      </Card>
                    ) : (
                      patientQuery.data.visits.map((visit) => (
                        <Card key={visit.id} className={staffCardClassName}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={visit.record_type === "gp_visit" ? "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10" : "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10"}>
                                {visitLabel(visit.record_type, visit.provider_role)}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {formatDate(visit.created_at)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-100">{visit.provider_name}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                              {visit.notes}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <Card className={staffCardClassName}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-200">Visit Notes</Label>
                          <Textarea
                            placeholder="Document symptoms, examination findings, and clinical assessment..."
                            className={`${staffTextareaClassName} min-h-[200px]`}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>
                        <Button
                          className={staffPrimaryButtonClassName}
                          onClick={() => saveVisitMutation.mutate()}
                          disabled={!notes.trim() || saveVisitMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4" />{" "}
                          {saveVisitMutation.isPending ? "Saving..." : "Save Notes"}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="refer" className="mt-4">
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      {[
                        {
                          type: "specialist" as const,
                          icon: Stethoscope,
                          label: "Refer to Specialist",
                          desc: "Refer patient for specialist consultation",
                        },
                        {
                          type: "lab" as const,
                          icon: FlaskConical,
                          label: "Order Lab Tests",
                          desc: "Request blood tests or diagnostics",
                        },
                      ].map((option) => (
                        <Card
                          key={option.type}
                          className={`cursor-pointer border-white/10 bg-slate-950/45 text-slate-100 transition-all hover:border-white/20 hover:bg-white/[0.04] ${
                            referralType === option.type ? "ring-2 ring-amber-300/40" : ""
                          }`}
                          onClick={() => setReferralType(option.type)}
                        >
                          <CardContent className="pt-6 text-center">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                              <option.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100">{option.label}</h3>
                            <p className="mt-1 text-xs text-slate-400">{option.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {referralType && (
                      <Card className={staffCardClassName}>
                        <CardContent className="pt-6 space-y-4">
                          <h3 className="font-semibold text-slate-100">
                            {referralType === "specialist" ? "Specialist Referral Notes" : "Lab Test Description"}
                          </h3>
                          <div className="space-y-2">
                            <Label className="text-slate-200">Details</Label>
                            <Textarea
                              placeholder={
                                referralType === "specialist"
                                  ? "Describe why this patient needs specialist review..."
                                  : "Describe the tests or diagnostics required..."
                              }
                              value={referralNotes}
                              onChange={(e) => setReferralNotes(e.target.value)}
                              className={staffTextareaClassName}
                            />
                          </div>
                          <Button
                            className={staffPrimaryButtonClassName}
                            onClick={() => referralMutation.mutate()}
                            disabled={!referralNotes.trim() || referralMutation.isPending}
                          >
                            <Send className="h-4 w-4" />{" "}
                            {referralMutation.isPending ? "Submitting..." : "Submit Referral"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="prescribe" className="mt-4">
                    <Card className={staffCardClassName}>
                      <CardHeader>
                        <CardTitle className="text-lg text-slate-100">Current Medications</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {patientQuery.data.medications.map((medication) => (
                          <div
                            key={medication.id}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-100">
                                {medication.medicine_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {medication.dosage_instruction}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-white/10 text-xs text-slate-300">
                              {formatRoleLabel(medication.status)}
                            </Badge>
                          </div>
                        ))}
                        {!patientQuery.data.medications.length && (
                          <p className="text-sm text-slate-400">
                            No medications recorded for this patient yet.
                          </p>
                        )}
                        <Separator />
                        <h4 className="pt-2 text-sm font-semibold text-slate-100">Add New Medication</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-200">Medication Name</Label>
                            <Input
                              placeholder="e.g. Amoxicillin"
                              className={staffInputClassName}
                              value={newMedName}
                              onChange={(e) => setNewMedName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-200">Dose & Frequency</Label>
                            <Input
                              placeholder="e.g. 500mg, 3x daily"
                              className={staffInputClassName}
                              value={newMedDose}
                              onChange={(e) => setNewMedDose(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          className={staffPrimaryButtonClassName}
                          onClick={() => medicationMutation.mutate()}
                          disabled={!newMedName.trim() || !newMedDose.trim() || medicationMutation.isPending}
                        >
                          <Plus className="h-4 w-4" />{" "}
                          {medicationMutation.isPending
                            ? "Adding..."
                            : "Add Medication & Send to Pharmacy"}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
      </div>
    </StaffPortalShell>
  );
}
