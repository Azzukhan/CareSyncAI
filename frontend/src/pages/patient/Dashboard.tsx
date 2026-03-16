import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  FlaskConical,
  Mail,
  MapPin,
  Pill,
  Phone,
  QrCode,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import ScannableQrPass from "@/components/ScannableQrPass";
import PatientShell from "@/components/patient/PatientShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPatientDashboard } from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatRoleLabel } from "@/lib/utils";

type HistoryEntry = {
  id: string;
  kind: "visit" | "lab" | "medication";
  title: string;
  meta: string;
  summary: string;
  createdAt: string;
};

export default function PatientDashboard() {
  const { token, user, logout } = useRequiredAuth("patient");

  const dashboardQuery = useQuery({
    queryKey: ["patient-dashboard", user?.nhs_healthcare_id],
    queryFn: () => getPatientDashboard(token!, user!.nhs_healthcare_id),
    enabled: Boolean(token && user),
  });

  const dashboard = dashboardQuery.data;
  const patient = dashboard?.patient;

  const latestHistory = useMemo<HistoryEntry[]>(() => {
    if (!dashboard) return [];

    const visitItems: HistoryEntry[] = dashboard.visits
      .filter((visit) => !visit.is_hidden_by_patient)
      .map((visit) => ({
        id: `visit-${visit.id}`,
        kind: "visit",
        title: formatRoleLabel(visit.record_type),
        meta: `${visit.provider_name} • ${formatRoleLabel(visit.provider_role)}`,
        summary: visit.notes,
        createdAt: visit.created_at,
      }));

    const labItems: HistoryEntry[] = dashboard.lab_reports.map((report) => ({
      id: `lab-${report.id}`,
      kind: "lab",
      title: report.test_description,
      meta: `${report.ordered_by_name} • ${formatRoleLabel(report.status)}`,
      summary: report.report_summary,
      createdAt: report.created_at,
    }));

    const medicationItems: HistoryEntry[] = dashboard.medications.map((medication) => ({
      id: `medication-${medication.id}`,
      kind: "medication",
      title: medication.medicine_name,
      meta: `${medication.prescribed_by_name} • ${formatRoleLabel(medication.status)}`,
      summary: medication.dosage_instruction,
      createdAt: medication.created_at,
    }));

    return [...visitItems, ...labItems, ...medicationItems]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5);
  }, [dashboard]);

  const historyPresentation = {
    visit: {
      label: "Visit",
      icon: ShieldCheck,
      iconClassName: "text-cyan-300",
      badgeClassName: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    },
    lab: {
      label: "Lab",
      icon: FlaskConical,
      iconClassName: "text-violet-300",
      badgeClassName: "border-violet-400/20 bg-violet-400/10 text-violet-100",
    },
    medication: {
      label: "Medication",
      icon: Pill,
      iconClassName: "text-emerald-300",
      badgeClassName: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    },
  } as const;

  return (
    <PatientShell
      title="Patient Dashboard"
      subtitle="Your details, digital health card, and the latest five health record updates."
      patientName={user?.full_name}
      onLogout={logout}
      workspaceMode
    >
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-white/10 bg-slate-950/40">
            <CardHeader className="pb-4">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Patient Details</p>
              <CardTitle className="mt-2 text-3xl">{patient?.full_name ?? user?.full_name ?? "Patient"}</CardTitle>
              <p className="text-sm text-slate-400">
                NHS number {patient?.nhs_healthcare_id ?? user?.nhs_healthcare_id ?? "Not available"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Email", patient?.email ?? user?.email ?? "Not on file", Mail],
                  ["Phone", patient?.phone_number ?? "Not on file", Phone],
                  ["Date of birth", patient?.date_of_birth ? formatDate(patient.date_of_birth) : "Not on file", CalendarDays],
                  ["Blood group", patient?.blood_group ?? "Not on file", UserRound],
                ].map(([label, value, Icon]) => (
                  <div
                    key={label as string}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <Icon className="h-4 w-4 text-cyan-300" />
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{label as string}</p>
                    <p className="mt-1 text-sm font-medium text-slate-100">{value as string}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Address</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {patient?.address ?? "Address not on file"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {patient?.allergies.map((item) => (
                  <Badge key={item} className="bg-rose-500/10 text-rose-200 hover:bg-rose-500/10">
                    {item}
                  </Badge>
                ))}
                {patient?.chronic_conditions.map((item) => (
                  <Badge key={item} variant="outline" className="border-white/10 text-slate-300">
                    {item}
                  </Badge>
                ))}
                {(patient?.allergies.length ?? 0) === 0 && (patient?.chronic_conditions.length ?? 0) === 0 ? (
                  <span className="text-sm text-slate-400">
                    No allergies or chronic conditions added yet.
                  </span>
                ) : null}
              </div>

              {dashboardQuery.isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Loading patient details...
                </div>
              ) : null}
            </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/40">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Digital Health Card</p>
                  <CardTitle className="mt-2 text-2xl">Scan, download, or share</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ScannableQrPass
                fullName={patient?.full_name ?? user?.full_name ?? "Patient"}
                nhsHealthcareId={patient?.nhs_healthcare_id ?? user?.nhs_healthcare_id ?? "NHS"}
                qrPayload={dashboard?.qr_payload ?? user?.nhs_healthcare_id ?? ""}
                dateOfBirth={patient?.date_of_birth}
                address={patient?.address}
                phoneNumber={patient?.phone_number}
                secondaryAction="share"
              />
            </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-slate-950/40">
          <CardHeader className="flex flex-row items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Health History</p>
              <CardTitle className="mt-2 text-2xl">Latest Five Updates</CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Recent visits, lab reports, and medication changes in one list.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 text-slate-300">
              {latestHistory.length} items
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboardQuery.isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                Loading your latest health history...
              </div>
            ) : dashboardQuery.isError ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                We could not load the latest health history right now.
              </div>
            ) : latestHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                No health history is available yet.
              </div>
            ) : (
              latestHistory.map((entry) => {
                const presentation = historyPresentation[entry.kind];
                const Icon = presentation.icon;

                return (
                  <div
                    key={entry.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-white/10 p-3">
                          <Icon className={`h-5 w-5 ${presentation.iconClassName}`} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={presentation.badgeClassName}>
                              {presentation.label}
                            </Badge>
                            <p className="text-xs text-slate-500">{entry.meta}</p>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-100">{entry.title}</h3>
                          <p className="text-sm text-slate-300">{entry.summary}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </PatientShell>
  );
}
