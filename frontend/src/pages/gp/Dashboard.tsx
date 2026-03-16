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
  Heart, LogOut, User, Users, Stethoscope, Clock,
  FileText, Pill, FlaskConical, Send, Plus, CheckCircle,
  ChevronRight, AlertCircle
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">CareSync</span>
            <Badge variant="secondary" className="ml-2">GP Portal</Badge>
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
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  Good Morning, {user?.full_name?.split(" ")[0] ?? "Doctor"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <QRScannerModal onPatientFound={setSelectedPatient} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Today's Patients",
                  value: summaryQuery.data?.todays_patient_count ?? 0,
                  icon: Users,
                  color: "text-primary",
                },
                {
                  label: "Today's Visits",
                  value: summaryQuery.data?.todays_visits ?? 0,
                  icon: CheckCircle,
                  color: "text-accent",
                },
                {
                  label: "Recent Patients",
                  value: summaryQuery.data?.recent_patients.length ?? 0,
                  icon: Clock,
                  color: "text-secondary",
                },
                {
                  label: "Last Refresh",
                  value: summaryQuery.data ? formatDate(summaryQuery.data.generated_at) : "N/A",
                  icon: AlertCircle,
                  color: "text-destructive",
                },
              ].map((summary) => (
                <Card key={summary.label}>
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <summary.icon className={`h-8 w-8 ${summary.color}`} />
                    <div>
                      <p className="text-2xl font-bold">{summary.value}</p>
                      <p className="text-xs text-muted-foreground">{summary.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Recent Patient Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : summaryQuery.data?.recent_patients.length ? (
                  <div className="space-y-2">
                    {summaryQuery.data.recent_patients.map((patient) => (
                      <button
                        key={patient.nhs_healthcare_id}
                        onClick={() => setSelectedPatient(patient.nhs_healthcare_id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{patient.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {patient.nhs_healthcare_id} • Last visit {formatDateTime(patient.last_visit_at)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
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
                variant="ghost"
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
              <Card>
                <CardContent className="pt-6">
                  <div className="h-24 rounded bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ) : patientQuery.isError || !patientQuery.data ? (
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
                      <div className="flex-1">
                        <h2 className="text-xl font-bold">{patientQuery.data.patient.full_name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {patientQuery.data.patient.nhs_healthcare_id}
                          {patientQuery.data.patient.date_of_birth
                            ? ` • DOB: ${patientQuery.data.patient.date_of_birth}`
                            : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {patientQuery.data.patient.blood_group && (
                            <Badge variant="secondary">
                              Blood: {patientQuery.data.patient.blood_group}
                            </Badge>
                          )}
                          {patientQuery.data.patient.allergies.map((allergy) => (
                            <Badge key={allergy} variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" /> {allergy}
                            </Badge>
                          ))}
                          {patientQuery.data.patient.chronic_conditions.map((condition) => (
                            <Badge key={condition} variant="outline">{condition}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="history">
                  <TabsList>
                    <TabsTrigger value="history" className="gap-1">
                      <FileText className="h-3 w-3" /> History
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="gap-1">
                      <Stethoscope className="h-3 w-3" /> Visit Notes
                    </TabsTrigger>
                    <TabsTrigger value="refer" className="gap-1">
                      <Send className="h-3 w-3" /> Refer
                    </TabsTrigger>
                    <TabsTrigger value="prescribe" className="gap-1">
                      <Pill className="h-3 w-3" /> Prescribe
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="space-y-3 mt-4">
                    {patientQuery.data.visits.length === 0 ? (
                      <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                          No visible history is available for this patient.
                        </CardContent>
                      </Card>
                    ) : (
                      patientQuery.data.visits.map((visit) => (
                        <Card key={visit.id}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
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
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <Card>
                      <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                          <Label>Visit Notes</Label>
                          <Textarea
                            placeholder="Document symptoms, examination findings, and clinical assessment..."
                            className="min-h-[200px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>
                        <Button
                          className="gradient-primary border-0 gap-2"
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
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            referralType === option.type ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => setReferralType(option.type)}
                        >
                          <CardContent className="pt-6 text-center">
                            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3">
                              <option.icon className="h-6 w-6 text-primary-foreground" />
                            </div>
                            <h3 className="font-semibold text-sm">{option.label}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {referralType && (
                      <Card>
                        <CardContent className="pt-6 space-y-4">
                          <h3 className="font-semibold">
                            {referralType === "specialist" ? "Specialist Referral Notes" : "Lab Test Description"}
                          </h3>
                          <div className="space-y-2">
                            <Label>Details</Label>
                            <Textarea
                              placeholder={
                                referralType === "specialist"
                                  ? "Describe why this patient needs specialist review..."
                                  : "Describe the tests or diagnostics required..."
                              }
                              value={referralNotes}
                              onChange={(e) => setReferralNotes(e.target.value)}
                              className="min-h-[120px]"
                            />
                          </div>
                          <Button
                            className="gradient-primary border-0 gap-2"
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Current Medications</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {patientQuery.data.medications.map((medication) => (
                          <div
                            key={medication.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {medication.medicine_name}
                              </p>
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
                            <Label>Medication Name</Label>
                            <Input
                              placeholder="e.g. Amoxicillin"
                              value={newMedName}
                              onChange={(e) => setNewMedName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Dose & Frequency</Label>
                            <Input
                              placeholder="e.g. 500mg, 3x daily"
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
    </div>
  );
}
