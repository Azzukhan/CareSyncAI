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
  User, Shield, FileText, Pill, FlaskConical,
  Send, Plus, AlertCircle, Stethoscope
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import StaffPortalShell, {
  staffCardClassName,
  staffInputClassName,
  staffPrimaryButtonClassName,
  staffSecondaryButtonClassName,
  staffTabListClassName,
  staffTabTriggerClassName,
  staffTextareaClassName,
} from "@/components/workspace/StaffPortalShell";
import { useToast } from "@/hooks/use-toast";
import {
  createSpecialistLabOrder,
  createSpecialistMedication,
  createSpecialistNote,
  getPatientDashboard,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatRoleLabel } from "@/lib/utils";

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

export default function SpecialistDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("specialist");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [labOrderNotes, setLabOrderNotes] = useState("");
  const [newMedName, setNewMedName] = useState("");
  const [newMedDose, setNewMedDose] = useState("");

  const patientQuery = useQuery({
    queryKey: ["specialist-patient-dashboard", selectedPatient],
    queryFn: () => getPatientDashboard(token!, selectedPatient!),
    enabled: isAuthenticated && Boolean(token) && Boolean(selectedPatient),
  });

  const refreshPatient = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["specialist-patient-dashboard", selectedPatient],
    });
  };

  const noteMutation = useMutation({
    mutationFn: () => createSpecialistNote(token!, {
      patientNhsHealthcareId: selectedPatient!,
      specialistNotes: notes,
    }),
    onSuccess: async () => {
      setNotes("");
      await refreshPatient();
      toast({ title: "Note saved", description: "The patient record has been updated." });
    },
    onError: (error) => {
      toast({
        title: "Unable to save note",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const labOrderMutation = useMutation({
    mutationFn: () => createSpecialistLabOrder(token!, {
      patientNhsHealthcareId: selectedPatient!,
      testDescription: labOrderNotes,
    }),
    onSuccess: async () => {
      setLabOrderNotes("");
      await refreshPatient();
      toast({ title: "Lab order sent", description: "The lab request has been created." });
    },
    onError: (error) => {
      toast({
        title: "Unable to order lab work",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const medicationMutation = useMutation({
    mutationFn: () => createSpecialistMedication(token!, {
      patientNhsHealthcareId: selectedPatient!,
      medicineName: newMedName,
      dosageInstruction: newMedDose,
    }),
    onSuccess: async () => {
      setNewMedName("");
      setNewMedDose("");
      await refreshPatient();
      toast({
        title: "Medication added",
        description: "The prescription is now visible to pharmacy staff.",
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

  const patient = patientQuery.data?.patient;
  const gpNotes = patientQuery.data?.visits.filter((visit) => visit.provider_role === "gp") ?? [];

  return (
    <StaffPortalShell portalLabel="Specialist Portal" userName={user?.full_name} onLogout={logout}>
      <div className="space-y-6">
        {!selectedPatient ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 rounded-[30px] border border-white/10 bg-slate-950/45 p-8 text-center shadow-[0_24px_70px_rgba(2,6,23,0.26)]">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <Shield className="h-12 w-12" />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">Specialist Workspace</p>
              <h1 className="mb-2 mt-2 text-3xl font-bold tracking-tight text-slate-100">Specialist Portal</h1>
              <p className="max-w-md text-slate-400">
                Scan a patient QR payload or enter their NHS ID to review live GP notes,
                medication history, and lab reports.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className={staffPrimaryButtonClassName}>
                  <Stethoscope className="h-5 w-5" /> Find Patient
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
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                        <User className="h-7 w-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-100">{patient.full_name}</h2>
                        <p className="text-sm text-slate-400">
                          {patient.nhs_healthcare_id}
                          {patient.date_of_birth ? ` • DOB: ${patient.date_of_birth}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {patient.blood_group && (
                            <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">Blood: {patient.blood_group}</Badge>
                          )}
                          {patient.allergies.map((allergy) => (
                            <Badge key={allergy} className="gap-1 bg-rose-500/10 text-rose-200 hover:bg-rose-500/10">
                              <AlertCircle className="h-3 w-3" /> {allergy}
                            </Badge>
                          ))}
                          {patient.chronic_conditions.map((condition) => (
                            <Badge key={condition} variant="outline" className="border-white/10 text-slate-300">{condition}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="gp-notes">
                  <TabsList className={staffTabListClassName}>
                    <TabsTrigger value="gp-notes" className={staffTabTriggerClassName}>
                      <Stethoscope className="h-3 w-3" /> GP Notes
                    </TabsTrigger>
                    <TabsTrigger value="history" className={staffTabTriggerClassName}>
                      <FileText className="h-3 w-3" /> Full History
                    </TabsTrigger>
                    <TabsTrigger value="labs" className={staffTabTriggerClassName}>
                      <FlaskConical className="h-3 w-3" /> Lab Reports
                    </TabsTrigger>
                    <TabsTrigger value="refer" className={staffTabTriggerClassName}>
                      <Send className="h-3 w-3" /> Order Lab Work
                    </TabsTrigger>
                    <TabsTrigger value="prescribe" className={staffTabTriggerClassName}>
                      <Pill className="h-3 w-3" /> Prescribe
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="gp-notes" className="space-y-3 mt-4">
                    <h3 className="text-sm font-semibold text-slate-400">
                      GP Notes and Referral Context
                    </h3>
                    {gpNotes.length === 0 ? (
                      <Card className={staffCardClassName}>
                        <CardContent className="pt-6 text-sm text-slate-400">
                          No GP notes are available for this patient yet.
                        </CardContent>
                      </Card>
                    ) : (
                      gpNotes.map((visit) => (
                        <Card key={visit.id} className={staffCardClassName}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">GP Visit</Badge>
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

                  <TabsContent value="history" className="space-y-3 mt-4">
                    {patientQuery.data.visits.map((visit) => (
                      <Card key={visit.id} className={staffCardClassName}>
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-1">
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
                    ))}
                    {!patientQuery.data.visits.length && (
                      <Card className={staffCardClassName}>
                        <CardContent className="pt-6 text-sm text-slate-400">
                          No clinical history is visible for this patient yet.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="labs" className="space-y-3 mt-4">
                    {patientQuery.data.lab_reports.map((report) => (
                      <Card key={report.id} className={staffCardClassName}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-base text-slate-100">{report.test_description}</CardTitle>
                              <Badge className={report.status === "completed" ? "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10" : "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10"}>
                              {formatRoleLabel(report.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {formatDate(report.created_at)} • Ordered by {report.ordered_by_name}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <p className="whitespace-pre-wrap text-sm text-slate-300">
                            {report.report_summary}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                    {!patientQuery.data.lab_reports.length && (
                      <Card className={staffCardClassName}>
                        <CardContent className="pt-6 text-sm text-slate-400">
                          No lab reports are available yet.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="refer" className="mt-4">
                    <Card className={staffCardClassName}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-200">Lab Test Request</Label>
                          <Textarea
                            placeholder="Describe the diagnostics or tests required..."
                            value={labOrderNotes}
                            onChange={(e) => setLabOrderNotes(e.target.value)}
                            className={staffTextareaClassName}
                          />
                        </div>
                        <Button
                          className={staffPrimaryButtonClassName}
                          onClick={() => labOrderMutation.mutate()}
                          disabled={!labOrderNotes.trim() || labOrderMutation.isPending}
                        >
                          <Send className="h-4 w-4" />{" "}
                          {labOrderMutation.isPending ? "Submitting..." : "Submit Lab Order"}
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className={`mt-4 ${staffCardClassName}`}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-200">Specialist Notes</Label>
                          <Textarea
                            placeholder="Add your specialist assessment to the patient record..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className={`${staffTextareaClassName} min-h-[140px]`}
                          />
                        </div>
                        <Button
                          className={staffPrimaryButtonClassName}
                          onClick={() => noteMutation.mutate()}
                          disabled={!notes.trim() || noteMutation.isPending}
                        >
                          <Send className="h-4 w-4" />{" "}
                          {noteMutation.isPending ? "Saving..." : "Save Specialist Note"}
                        </Button>
                      </CardContent>
                    </Card>
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
                              <p className="text-sm font-medium text-slate-100">{medication.medicine_name}</p>
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
                            <Label className="text-slate-200">Name</Label>
                            <Input
                              placeholder="e.g. Prednisolone"
                              className={staffInputClassName}
                              value={newMedName}
                              onChange={(e) => setNewMedName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-200">Dose</Label>
                            <Input
                              placeholder="e.g. 5mg, once daily"
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
                          {medicationMutation.isPending ? "Adding..." : "Add & Send to Pharmacy"}
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
