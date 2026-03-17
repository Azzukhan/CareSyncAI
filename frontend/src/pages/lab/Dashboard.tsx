import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  User, FlaskConical, Upload, CheckCircle, AlertCircle, FileText
} from "lucide-react";
import QRScannerModal from "@/components/QRScannerModal";
import StaffPortalShell, {
  staffCardClassName,
  staffInputClassName,
  staffPrimaryButtonClassName,
  staffSecondaryButtonClassName,
  staffTextareaClassName,
} from "@/components/workspace/StaffPortalShell";
import {
  workspaceAccentSoftBadgeClassName,
  workspaceEyebrowClassName,
  workspaceIconSurfaceClassName,
  workspaceOutlineBadgeClassName,
} from "@/components/workspace/workspaceTheme";
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
    <StaffPortalShell portalLabel="Lab Portal" userName={user?.full_name} onLogout={logout}>
      <div className="space-y-6">
        {!selectedPatient ? (
          <div className={`${staffCardClassName} flex min-h-[60vh] flex-col items-center justify-center space-y-6 rounded-[30px] p-8 text-center`}>
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <FlaskConical className="h-12 w-12" />
            </div>
            <div className="text-center">
              <p className={workspaceEyebrowClassName}>Lab Workspace</p>
              <h1 className="mb-2 mt-2 text-3xl font-bold tracking-tight text-slate-100">Lab Portal</h1>
              <p className="max-w-md text-slate-400">
                Search by NHS ID or QR payload to review open lab orders and attach completed results.
              </p>
            </div>
            <QRScannerModal
              onPatientFound={setSelectedPatient}
              trigger={
                <Button size="lg" className={staffPrimaryButtonClassName}>
                  <FlaskConical className="h-5 w-5" /> Find Patient
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

                {pendingTests.length > 0 && (
                  <Card className={staffCardClassName}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                        <FlaskConical className="h-5 w-5 text-amber-300" /> Pending Tests
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pendingTests.map((test) => {
                        const draft = drafts[test.id] ?? { reportSummary: "", reportFile: null };
                        return (
                          <div
                            key={test.id}
                            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-100">{test.test_description}</p>
                                <p className="text-xs text-slate-400">
                                  Order ID: {test.id}
                                </p>
                              </div>
                              <Badge className={workspaceAccentSoftBadgeClassName}>{formatRoleLabel(test.status)}</Badge>
                            </div>
                            <div className="space-y-3 border-t border-white/10 pt-2">
                              <h4 className="text-sm font-medium text-slate-100">Upload Results</h4>
                              <div className="space-y-2">
                                <Label className="text-slate-200">Result Summary</Label>
                                <Textarea
                                  placeholder="Enter test findings and values..."
                                  className={`${staffTextareaClassName} min-h-[80px]`}
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
                                <Label className="text-slate-200">Report File (optional)</Label>
                                <Input
                                  type="file"
                                  accept=".pdf,image/png,image/jpeg,image/jpg"
                                  className={staffInputClassName}
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
                                  <p className="text-xs text-slate-400">
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
                                className={staffPrimaryButtonClassName}
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

                <Card className={staffCardClassName}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
                      <FileText className="h-5 w-5 text-amber-300" /> Completed Tests
                      </CardTitle>
                    </CardHeader>
                  <CardContent className="space-y-3">
                    {completedTests.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No completed lab reports are available for this patient yet.
                      </p>
                    ) : (
                      completedTests.map((test) => (
                        <div key={test.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-medium text-slate-100">{test.test_description}</p>
                            <Badge className={workspaceAccentSoftBadgeClassName}>{formatRoleLabel(test.status)}</Badge>
                          </div>
                          <p className="mb-2 text-xs text-slate-400">
                            {formatDate(test.created_at)} • Ordered by {test.ordered_by_name}
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-slate-300">
                            {test.report_summary}
                          </p>
                          {test.file_url && (
                            <a
                              href={resolveApiUrl(test.file_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex text-sm text-amber-300 hover:text-amber-200 hover:underline"
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
    </StaffPortalShell>
  );
}
