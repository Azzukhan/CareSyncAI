import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FlaskConical,
  Eye,
  EyeOff,
  Pill,
  Shield,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import PatientShell from "@/components/patient/PatientShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  workspaceAccentSoftBadgeClassName,
  workspaceCardClassName,
  workspaceIconAccentClassName,
  workspaceOutlineBadgeClassName,
  workspaceSoftPanelClassName,
} from "@/components/workspace/workspaceTheme";
import { useToast } from "@/hooks/use-toast";
import {
  bulkUpdateHistoryAccess,
  getMyPatientProfile,
  getPatientDashboard,
  resolveApiUrl,
  updateHistoryAccess,
  type HistoryRecordSource,
  type PatientDashboardResponse,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatRoleLabel } from "@/lib/utils";

export type PatientHistoryFilter =
  | "all"
  | "labs"
  | "medicine"
  | "gp-visits"
  | "specialist";

type HistoryEntryKind = "visit" | "lab" | "medication";

type HistoryEntry = {
  id: string;
  recordId: string;
  sourceKind: HistoryRecordSource;
  kind: HistoryEntryKind;
  title: string;
  meta: string;
  summary: string;
  createdAt: string;
  statusLabel?: string;
  fileUrl?: string | null;
  isHidden?: boolean;
  sharedWithGp: boolean;
  sharedWithSpecialist: boolean;
};

const filterConfig: Record<
  PatientHistoryFilter,
  {
    title: string;
    subtitle: string;
    badgeLabel: string;
  }
> = {
  all: {
    title: "Medical History",
    subtitle: "See all visits, labs, and medicines recorded in your patient account.",
    badgeLabel: "All history",
  },
  labs: {
    title: "Lab Reports",
    subtitle: "Review your recorded lab reports, report status, and available files.",
    badgeLabel: "Lab reports",
  },
  medicine: {
    title: "Medicine",
    subtitle: "View all medicines prescribed for you and their current status.",
    badgeLabel: "Medicine",
  },
  "gp-visits": {
    title: "GP Visits",
    subtitle: "See appointments, notes, and visit history written by GP providers.",
    badgeLabel: "GP visits",
  },
  specialist: {
    title: "Specialist History",
    subtitle: "See visits and notes recorded by specialist providers.",
    badgeLabel: "Specialist",
  },
};

const historyPresentation = {
  visit: {
    label: "Visit",
    icon: ShieldCheck,
    iconClassName: workspaceIconAccentClassName,
    badgeClassName: workspaceAccentSoftBadgeClassName,
  },
  lab: {
    label: "Lab",
    icon: FlaskConical,
    iconClassName: workspaceIconAccentClassName,
    badgeClassName: workspaceAccentSoftBadgeClassName,
  },
  medication: {
    label: "Medicine",
    icon: Pill,
    iconClassName: workspaceIconAccentClassName,
    badgeClassName: workspaceAccentSoftBadgeClassName,
  },
} as const;

function buildHistoryEntries(
  dashboard: PatientDashboardResponse | undefined,
): HistoryEntry[] {
  if (!dashboard) {
    return [];
  }

  const visitItems: HistoryEntry[] = dashboard.visits.map((visit) => ({
    id: `visit-${visit.id}`,
    recordId: visit.id,
    sourceKind: visit.source_kind,
    kind: "visit",
    title: formatRoleLabel(visit.record_type),
    meta: `${visit.provider_name} • ${formatRoleLabel(visit.provider_role)}`,
    summary: visit.notes,
    createdAt: visit.created_at,
    isHidden: visit.is_hidden_by_patient,
    sharedWithGp: visit.shared_with_gp,
    sharedWithSpecialist: visit.shared_with_specialist,
  }));

  const labItems: HistoryEntry[] = dashboard.lab_reports.map((report) => ({
    id: `lab-${report.id}`,
    recordId: report.id,
    sourceKind: "lab_report",
    kind: "lab",
    title: report.test_description,
    meta: report.ordered_by_name,
    summary: report.report_summary,
    createdAt: report.created_at,
    statusLabel: formatRoleLabel(report.status),
    fileUrl: report.file_url,
    sharedWithGp: report.shared_with_gp,
    sharedWithSpecialist: report.shared_with_specialist,
  }));

  const medicationItems: HistoryEntry[] = dashboard.medications.map((medication) => ({
    id: `medication-${medication.id}`,
    recordId: medication.id,
    sourceKind: "medication_order",
    kind: "medication",
    title: medication.medicine_name,
    meta: medication.prescribed_by_name,
    summary: medication.dosage_instruction,
    createdAt: medication.created_at,
    statusLabel: formatRoleLabel(medication.status),
    sharedWithGp: medication.shared_with_gp,
    sharedWithSpecialist: medication.shared_with_specialist,
  }));

  return [...visitItems, ...labItems, ...medicationItems].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function PatientHistoryPage({ filter }: { filter: PatientHistoryFilter }) {
  const { token, user, logout } = useRequiredAuth("patient");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const profileQuery = useQuery({
    queryKey: ["patient-profile-summary"],
    queryFn: () => getMyPatientProfile(token!),
    enabled: Boolean(token),
  });

  const dashboardQuery = useQuery({
    queryKey: ["patient-dashboard", user?.nhs_healthcare_id],
    queryFn: () => getPatientDashboard(token!, user!.nhs_healthcare_id),
    enabled: Boolean(token && user),
  });

  const refreshDashboard = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["patient-dashboard", user?.nhs_healthcare_id],
    });
  };

  const updateAccessMutation = useMutation({
    mutationFn: (input: {
      recordId: string;
      recordSource: HistoryRecordSource;
      isHiddenByPatient?: boolean;
      sharedWithGp?: boolean;
      sharedWithSpecialist?: boolean;
    }) => updateHistoryAccess(token!, input.recordId, input),
    onSuccess: async () => {
      await refreshDashboard();
      toast({ title: "Record access updated" });
    },
    onError: (error) => {
      toast({
        title: "Unable to update record access",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const bulkAccessMutation = useMutation({
    mutationFn: (input: { sharedWithGp?: boolean; sharedWithSpecialist?: boolean }) =>
      bulkUpdateHistoryAccess(token!, input),
    onSuccess: async () => {
      await refreshDashboard();
      toast({ title: "History access updated" });
    },
    onError: (error) => {
      toast({
        title: "Unable to update history access",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const dashboard = dashboardQuery.data;
  const patient = dashboard?.patient ?? profileQuery.data;
  const allEntries = useMemo(() => buildHistoryEntries(dashboard), [dashboard]);

  const filteredEntries = useMemo(() => {
    switch (filter) {
      case "labs":
        return allEntries.filter((entry) => entry.kind === "lab");
      case "medicine":
        return allEntries.filter((entry) => entry.kind === "medication");
      case "gp-visits":
        return allEntries.filter(
          (entry) => entry.kind === "visit" && entry.sourceKind === "gp_visit",
        );
      case "specialist":
        return allEntries.filter(
          (entry) =>
            entry.kind === "visit" && entry.sourceKind === "specialist_referral",
        );
      default:
        return allEntries;
    }
  }, [allEntries, filter]);

  const visibleCount = filteredEntries.length;
  const gpVisitCount = allEntries.filter(
    (entry) => entry.kind === "visit" && entry.sourceKind === "gp_visit",
  ).length;
  const specialistCount = allEntries.filter(
    (entry) => entry.kind === "visit" && entry.sourceKind === "specialist_referral",
  ).length;
  const labCount = allEntries.filter((entry) => entry.kind === "lab").length;
  const medicineCount = allEntries.filter((entry) => entry.kind === "medication").length;
  const hiddenCount = allEntries.filter((entry) => entry.kind === "visit" && entry.isHidden).length;
  const shareableCount = allEntries.length;
  const gpSharedCount = allEntries.filter((entry) => entry.sharedWithGp).length;
  const specialistSharedCount = allEntries.filter((entry) => entry.sharedWithSpecialist).length;
  const allGpSelected = shareableCount > 0 && gpSharedCount === shareableCount;
  const allSpecialistSelected =
    shareableCount > 0 && specialistSharedCount === shareableCount;

  const config = filterConfig[filter];
  const controlsDisabled =
    updateAccessMutation.isPending || bulkAccessMutation.isPending || dashboardQuery.isLoading;
  const historyLoadError =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : "We could not load your medical history right now.";

  const snapshotStats = (() => {
    switch (filter) {
      case "labs":
        return [
          ["Lab reports", labCount, FlaskConical],
          ["Shared with GP", gpSharedCount, Shield],
          ["Shared with specialist", specialistSharedCount, CheckCircle2],
        ] as const;
      case "medicine":
        return [
          ["Medicine", medicineCount, Pill],
          ["Shared with GP", gpSharedCount, Shield],
          ["Shared with specialist", specialistSharedCount, CheckCircle2],
        ] as const;
      case "gp-visits":
        return [
          ["GP visits", gpVisitCount, Stethoscope],
          ["Shared with GP", gpSharedCount, Shield],
          ["Hidden visits", hiddenCount, ShieldCheck],
        ] as const;
      case "specialist":
        return [
          ["Specialist", specialistCount, UserRound],
          ["Shared with specialist", specialistSharedCount, CheckCircle2],
          ["Hidden visits", hiddenCount, ShieldCheck],
        ] as const;
      default:
        return [
          ["Lab reports", labCount, FlaskConical],
          ["Medicine", medicineCount, Pill],
          ["GP visits", gpVisitCount, Stethoscope],
          ["Specialist", specialistCount, UserRound],
          ["Shared with GP", gpSharedCount, Shield],
          ["Shared with specialist", specialistSharedCount, CheckCircle2],
          ["Hidden visits", hiddenCount, ShieldCheck],
        ] as const;
    }
  })();

  return (
    <PatientShell
      title={config.title}
      subtitle={config.subtitle}
      patientName={user?.full_name}
      onLogout={logout}
      workspaceMode
    >
      <ScrollArea className="h-full">
        <div className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
          {filter === "all" && !dashboardQuery.isLoading && !dashboardQuery.isError ? (
            <Card className={workspaceCardClassName}>
              <CardHeader>
                <CardTitle className="text-base">History Access Controls</CardTitle>
                <p className="text-sm text-slate-400">
                  GP and specialist access starts disabled by default. Use select-all here, then
                  fine-tune individual records below.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className={workspaceSoftPanelClassName + " p-4"}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Select all for GP</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Share every history record with GP access.
                      </p>
                      <p className="mt-3 text-xs text-amber-200">
                        {gpSharedCount}/{shareableCount} records shared
                      </p>
                    </div>
                    <Switch
                      checked={allGpSelected}
                      disabled={controlsDisabled || shareableCount === 0}
                      onCheckedChange={(checked) =>
                        bulkAccessMutation.mutate({ sharedWithGp: checked })
                      }
                    />
                  </div>
                </div>

                <div className={workspaceSoftPanelClassName + " p-4"}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Select all for Specialist</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Share every history record with specialist access.
                      </p>
                      <p className="mt-3 text-xs text-amber-200">
                        {specialistSharedCount}/{shareableCount} records shared
                      </p>
                    </div>
                    <Switch
                      checked={allSpecialistSelected}
                      disabled={controlsDisabled || shareableCount === 0}
                      onCheckedChange={(checked) =>
                        bulkAccessMutation.mutate({ sharedWithSpecialist: checked })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className={workspaceCardClassName}>
            <CardHeader className="flex flex-row items-end justify-between gap-4">
              <div>
                <CardTitle className="text-base">Records</CardTitle>
              </div>
              <Badge variant="outline" className={workspaceOutlineBadgeClassName}>
                {visibleCount} record{visibleCount === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardQuery.isLoading ? (
                <div className={workspaceSoftPanelClassName + " p-5 text-sm text-slate-400"}>
                  Loading patient records...
                </div>
              ) : dashboardQuery.isError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">
                  {historyLoadError}
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  No records are available for this category yet.
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const presentation = historyPresentation[entry.kind];
                  const Icon = presentation.icon;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="rounded-2xl bg-white/10 p-3">
                            <Icon className={`h-5 w-5 ${presentation.iconClassName}`} />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={presentation.badgeClassName}>
                                {presentation.label}
                              </Badge>
                              {entry.sharedWithGp ? (
                              <Badge className={workspaceAccentSoftBadgeClassName}>
                                GP access
                              </Badge>
                              ) : null}
                              {entry.sharedWithSpecialist ? (
                                <Badge className={workspaceAccentSoftBadgeClassName}>
                                  Specialist access
                                </Badge>
                              ) : null}
                              {entry.statusLabel ? (
                                <Badge variant="outline" className={workspaceOutlineBadgeClassName}>
                                  {entry.statusLabel}
                                </Badge>
                              ) : null}
                              {entry.isHidden ? (
                                <Badge className="bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">
                                  Hidden
                                </Badge>
                              ) : null}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-100">{entry.title}</h3>
                            <p className="text-sm text-slate-400">{entry.meta}</p>
                            <p className="text-sm text-slate-300">{entry.summary}</p>
                            {entry.fileUrl ? (
                              <Button asChild size="sm" variant="outline" className={workspaceSoftPanelClassName}>
                                <a
                                  href={resolveApiUrl(entry.fileUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open report file
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                      </div>

                      {filter === "all" ? (
                        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2 xl:grid-cols-3">
                          {entry.kind === "visit" ? (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {entry.isHidden ? (
                                      <EyeOff className="h-4 w-4 text-amber-300" />
                                    ) : (
                                      <Eye className={`h-4 w-4 ${workspaceIconAccentClassName}`} />
                                    )}
                                    <p className="text-sm font-medium text-slate-100">Show record</p>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Hidden visits stay in your account but disappear from provider history.
                                  </p>
                                </div>
                                <Switch
                                  checked={!entry.isHidden}
                                  disabled={controlsDisabled}
                                  onCheckedChange={(checked) =>
                                    updateAccessMutation.mutate({
                                      recordId: entry.recordId,
                                      recordSource: entry.sourceKind,
                                      isHiddenByPatient: !checked,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Shield className={`h-4 w-4 ${workspaceIconAccentClassName}`} />
                                  <p className="text-sm font-medium text-slate-100">GP access</p>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                  Let GP users see this record in their patient dashboard.
                                </p>
                              </div>
                              <Switch
                                checked={entry.sharedWithGp}
                                disabled={controlsDisabled}
                                onCheckedChange={(checked) =>
                                  updateAccessMutation.mutate({
                                    recordId: entry.recordId,
                                    recordSource: entry.sourceKind,
                                    sharedWithGp: checked,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className={`h-4 w-4 ${workspaceIconAccentClassName}`} />
                                  <p className="text-sm font-medium text-slate-100">
                                    Specialist access
                                  </p>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                  Let specialist users see this record in their patient dashboard.
                                </p>
                              </div>
                              <Switch
                                checked={entry.sharedWithSpecialist}
                                disabled={controlsDisabled}
                                onCheckedChange={(checked) =>
                                  updateAccessMutation.mutate({
                                    recordId: entry.recordId,
                                    recordSource: entry.sourceKind,
                                    sharedWithSpecialist: checked,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          </div>

          <div className="space-y-3">
            <Card className={workspaceCardClassName}>
            <CardHeader>
              <CardTitle className="text-base">Patient Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={workspaceSoftPanelClassName + " p-4"}>
                <p className="font-medium text-slate-100">
                  {patient?.full_name ?? user?.full_name ?? "Patient"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {patient?.nhs_healthcare_id ?? user?.nhs_healthcare_id}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  {profileQuery.isLoading
                    ? "Loading date of birth..."
                    : patient?.date_of_birth
                      ? formatDate(patient.date_of_birth)
                      : "Date of birth not on file"}
                </p>
              </div>

              {dashboardQuery.isError ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  History totals are unavailable until the record feed loads again.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {snapshotStats.map(([label, value, Icon]) => (
                    <div
                      key={label as string}
                      className={workspaceSoftPanelClassName + " p-3"}
                    >
                      <Icon className={`h-4 w-4 ${workspaceIconAccentClassName}`} />
                      <p className="mt-3 text-xs text-slate-400">{label as string}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{value as number}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            </Card>

            {filter === "all" && !dashboardQuery.isError ? (
              <Card className={workspaceCardClassName}>
              <CardHeader>
                <CardTitle className="text-base">Access Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-400">
                <p>All History combines visits, lab reports, and medicines in newest-first order.</p>
                <p>GP and specialist access is off by default until you select all or switch records on.</p>
                <p>Hide/show only applies to visit records. Labs and medicines stay visible to you.</p>
              </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    </PatientShell>
  );
}
