import { useState } from "react";
import { Link } from "react-router-dom";
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
  Heart, LogOut, User, Shield, FileText, Pill, FlaskConical,
  Send, Plus, AlertCircle, Stethoscope
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">CareSync</span>
            <Badge variant="secondary" className="ml-2">Specialist Portal</Badge>
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
              <Shield className="h-12 w-12 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Specialist Portal</h1>
              <p className="text-muted-foreground max-w-md">
                Scan a patient QR payload or enter their NHS ID to review live GP notes,
                medication history, and lab reports.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className="gradient-primary border-0 gap-2">
                  <Stethoscope className="h-5 w-5" /> Find Patient
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
                          {patient.blood_group && (
                            <Badge variant="secondary">Blood: {patient.blood_group}</Badge>
                          )}
                          {patient.allergies.map((allergy) => (
                            <Badge key={allergy} variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" /> {allergy}
                            </Badge>
                          ))}
                          {patient.chronic_conditions.map((condition) => (
                            <Badge key={condition} variant="outline">{condition}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="gp-notes">
                  <TabsList>
                    <TabsTrigger value="gp-notes" className="gap-1">
                      <Stethoscope className="h-3 w-3" /> GP Notes
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1">
                      <FileText className="h-3 w-3" /> Full History
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="gap-1">
                      <FlaskConical className="h-3 w-3" /> Lab Reports
                    </TabsTrigger>
                    <TabsTrigger value="refer" className="gap-1">
                      <Send className="h-3 w-3" /> Order Lab Work
                    </TabsTrigger>
                    <TabsTrigger value="prescribe" className="gap-1">
                      <Pill className="h-3 w-3" /> Prescribe
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="gp-notes" className="space-y-3 mt-4">
                    <h3 className="font-semibold text-muted-foreground text-sm">
                      GP Notes and Referral Context
                    </h3>
                    {gpNotes.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                          No GP notes are available for this patient yet.
                        </CardContent>
                      </Card>
                    ) : (
                      gpNotes.map((visit) => (
                        <Card key={visit.id}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>GP Visit</Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(visit.created_at)}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{visit.provider_name}</p>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                              {visit.notes}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3 mt-4">
                    {patientQuery.data.visits.map((visit) => (
                      <Card key={visit.id}>
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={visit.record_type === "gp_visit" ? "default" : "secondary"}>
                                {visitLabel(visit.record_type, visit.provider_role)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(visit.created_at)}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{visit.provider_name}</p>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {visit.notes}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                    {!patientQuery.data.visits.length && (
                      <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                          No clinical history is visible for this patient yet.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="labs" className="space-y-3 mt-4">
                    {patientQuery.data.lab_reports.map((report) => (
                      <Card key={report.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-base">{report.test_description}</CardTitle>
                            <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                              {formatRoleLabel(report.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(report.created_at)} • Ordered by {report.ordered_by_name}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {report.report_summary}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                    {!patientQuery.data.lab_reports.length && (
                      <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                          No lab reports are available yet.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="refer" className="mt-4">
                    <Card>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label>Lab Test Request</Label>
                          <Textarea
                            placeholder="Describe the diagnostics or tests required..."
                            value={labOrderNotes}
                            onChange={(e) => setLabOrderNotes(e.target.value)}
                            className="min-h-[120px]"
                          />
                        </div>
                        <Button
                          className="gradient-primary border-0 gap-2"
                          onClick={() => labOrderMutation.mutate()}
                          disabled={!labOrderNotes.trim() || labOrderMutation.isPending}
                        >
                          <Send className="h-4 w-4" />{" "}
                          {labOrderMutation.isPending ? "Submitting..." : "Submit Lab Order"}
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="mt-4">
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label>Specialist Notes</Label>
                          <Textarea
                            placeholder="Add your specialist assessment to the patient record..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[140px]"
                          />
                        </div>
                        <Button
                          className="gradient-primary border-0 gap-2"
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Current Medications</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {patientQuery.data.medications.map((medication) => (
                          <div
                            key={medication.id}
                            className="flex justify-between items-center p-3 rounded-lg border"
                          >
                            <div>
                              <p className="font-medium text-sm">{medication.medicine_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {medication.dosage_instruction}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {formatRoleLabel(medication.status)}
                            </Badge>
                          </div>
                        ))}
                        {!patientQuery.data.medications.length && (
                          <p className="text-sm text-muted-foreground">
                            No medications recorded for this patient yet.
                          </p>
                        )}
                        <Separator />
                        <h4 className="font-semibold text-sm pt-2">Add New Medication</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              placeholder="e.g. Prednisolone"
                              value={newMedName}
                              onChange={(e) => setNewMedName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Dose</Label>
                            <Input
                              placeholder="e.g. 5mg, once daily"
                              value={newMedDose}
                              onChange={(e) => setNewMedDose(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          className="gradient-primary border-0 gap-2"
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
    </div>
  );
}
