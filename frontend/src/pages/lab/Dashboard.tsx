import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Heart, LogOut, User, FlaskConical, Upload, CheckCircle, AlertCircle, FileText
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import { useToast } from "@/hooks/use-toast";
import { getPatientDashboard, listLabOrders, resolveApiUrl, uploadLabReport } from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatRoleLabel } from "@/lib/utils";

interface LabDraft {
  reportSummary: string;
  reportFile: File | null;
}

export default function LabDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("lab");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LabDraft>>({});

  const ordersQuery = useQuery({
    queryKey: ["lab-orders"],
    queryFn: () => listLabOrders(token!),
    enabled: isAuthenticated && Boolean(token),
  });

  const patientQuery = useQuery({
    queryKey: ["lab-patient-dashboard", selectedPatient],
    queryFn: () => getPatientDashboard(token!, selectedPatient!),
    enabled: isAuthenticated && Boolean(token) && Boolean(selectedPatient),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ orderId, reportSummary, reportFile }: { orderId: string; reportSummary: string; reportFile: File | null }) =>
      uploadLabReport(token!, {
        labOrderId: orderId,
        reportSummary,
        reportFile,
      }),
    onSuccess: async (_, variables) => {
      setDrafts((current) => ({
        ...current,
        [variables.orderId]: { reportSummary: "", reportFile: null },
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lab-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["lab-patient-dashboard", selectedPatient] }),
      ]);
      toast({ title: "Report uploaded", description: "The patient record now includes the result." });
    },
    onError: (error) => {
      toast({
        title: "Unable to upload report",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return null;
  }

  const patient = patientQuery.data?.patient;
  const patientOrders = patient && ordersQuery.data
    ? ordersQuery.data.items.filter((order) => order.patient_user_id === patient.user_id)
    : [];
  const pendingTests = patientOrders.filter((order) => order.status !== "completed");
  const completedTests = patientQuery.data?.lab_reports ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">CareSync</span>
            <Badge variant="secondary" className="ml-2">Lab Portal</Badge>
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
            <div className="h-24 w-24 rounded-3xl gradient-accent flex items-center justify-center">
              <FlaskConical className="h-12 w-12 text-accent-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Lab Portal</h1>
              <p className="text-muted-foreground max-w-md">
                Search by NHS ID or QR payload to review open lab orders and attach completed results.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className="gradient-accent border-0 gap-2 text-accent-foreground">
                  <FlaskConical className="h-5 w-5" /> Find Patient
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

                {pendingTests.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-secondary">
                        <FlaskConical className="h-5 w-5" /> Pending Tests
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pendingTests.map((test) => {
                        const draft = drafts[test.id] ?? { reportSummary: "", reportFile: null };
                        return (
                          <div
                            key={test.id}
                            className="p-4 rounded-lg border border-secondary/30 bg-secondary/5 space-y-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{test.test_description}</p>
                                <p className="text-xs text-muted-foreground">
                                  Order ID: {test.id}
                                </p>
                              </div>
                              <Badge variant="secondary">{formatRoleLabel(test.status)}</Badge>
                            </div>
                            <div className="space-y-3 pt-2 border-t">
                              <h4 className="font-medium text-sm">Upload Results</h4>
                              <div className="space-y-2">
                                <Label>Result Summary</Label>
                                <Textarea
                                  placeholder="Enter test findings and values..."
                                  className="min-h-[80px]"
                                  value={draft.reportSummary}
                                  onChange={(e) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [test.id]: { ...draft, reportSummary: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Report File (optional)</Label>
                                <Input
                                  type="file"
                                  accept=".pdf,image/png,image/jpeg,image/jpg"
                                  onChange={(e) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [test.id]: {
                                        ...draft,
                                        reportFile: e.target.files?.[0] ?? null,
                                      },
                                    }))
                                  }
                                />
                                {draft.reportFile && (
                                  <p className="text-xs text-muted-foreground">
                                    Selected file: {draft.reportFile.name}
                                  </p>
                                )}
                              </div>
                              <Button
                                onClick={() =>
                                  uploadMutation.mutate({
                                    orderId: test.id,
                                    reportSummary: draft.reportSummary,
                                    reportFile: draft.reportFile,
                                  })
                                }
                                className="gradient-accent border-0 gap-2 text-accent-foreground"
                                disabled={!draft.reportSummary.trim() || uploadMutation.isPending}
                              >
                                <Upload className="h-4 w-4" />
                                {uploadMutation.isPending ? "Uploading..." : "Upload Results"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Completed Tests
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {completedTests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No completed lab reports are available for this patient yet.
                      </p>
                    ) : (
                      completedTests.map((test) => (
                        <div key={test.id} className="p-3 rounded-lg border">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium text-sm">{test.test_description}</p>
                            <Badge>{formatRoleLabel(test.status)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {formatDate(test.created_at)} • Ordered by {test.ordered_by_name}
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {test.report_summary}
                          </p>
                          {test.file_url && (
                            <a
                              href={resolveApiUrl(test.file_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex mt-2 text-sm text-primary hover:underline"
                            >
                              Open attached report
                            </a>
                          )}
                        </div>
                      ))
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
