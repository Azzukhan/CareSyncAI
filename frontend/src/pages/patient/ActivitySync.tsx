import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Heart,
  MessageSquareHeart,
  ShieldCheck,
  Upload,
} from "lucide-react";

import PatientShell from "@/components/patient/PatientShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  type HealthAppProvider,
  type HealthFileUpload,
  type HealthMetricEntry,
  getActivityOverview,
  getAgenticProfile,
  getHealthFiles,
  getHealthMetrics,
  listHealthAppConnections,
  logHealthMetric,
  updateAgenticProfile,
  uploadHealthFile,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import {
  workspaceAccentSoftBadgeClassName,
  workspaceCardClassName,
  workspaceEyebrowClassName,
  workspaceIconSurfaceClassName,
  workspaceOutlineBadgeClassName,
  workspacePrimaryButtonClassName,
  workspaceSecondaryButtonClassName,
  workspaceSoftPanelClassName,
} from "@/components/workspace/workspaceTheme";

const providerCards: {
  provider: HealthAppProvider;
  title: string;
  description: string;
}[] = [
  {
    provider: "apple_health",
    title: "Apple Health",
    description: "Use iPhone and Apple Watch activity data for steps, distance, and workouts in CareSync.",
  },
  {
    provider: "google_fit",
    title: "Google Fitness",
    description: "Bring Android and Wear OS activity summaries into the patient workspace.",
  },
];

const quickMetricFields: {
  metricType: "steps" | "active_minutes" | "distance_km" | "sleep_hours" | "calories";
  label: string;
  unit: string;
  placeholder: string;
}[] = [
  { metricType: "steps", label: "Steps", unit: "steps", placeholder: "8500" },
  { metricType: "active_minutes", label: "Active minutes", unit: "minutes", placeholder: "42" },
  { metricType: "distance_km", label: "Running / distance", unit: "km", placeholder: "4.8" },
  { metricType: "sleep_hours", label: "Sleep", unit: "hours", placeholder: "7.5" },
  { metricType: "calories", label: "Calories burned", unit: "kcal", placeholder: "540" },
];

const metricLabels: Record<string, string> = {
  steps: "Steps",
  active_minutes: "Active minutes",
  distance_km: "Distance",
  sleep_hours: "Sleep",
  calories: "Calories burned",
  heart_rate: "Heart rate",
  weight: "Weight",
  blood_pressure: "Blood pressure",
};

const providerLabels: Record<HealthAppProvider, string> = {
  apple_health: "Apple Health",
  google_fit: "Google Fitness",
};

function buildImportSourceLine(item: HealthFileUpload): string | null {
  const parts = [
    item.provider ? providerLabels[item.provider] : null,
    item.export_date ? `Exported ${formatDateTime(item.export_date)}` : null,
    item.source_date_start && item.source_date_end
      ? `${item.source_date_start} to ${item.source_date_end}`
      : item.source_date_start ?? item.source_date_end ?? null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" • ") : null;
}

function buildImportCountLine(item: HealthFileUpload): string {
  const parts = [
    item.source_tag_counts?.Record
      ? `${item.source_tag_counts.Record.toLocaleString()} Apple records`
      : null,
    item.source_tag_counts?.Workout
      ? `${item.source_tag_counts.Workout} workout${item.source_tag_counts.Workout === 1 ? "" : "s"}`
      : null,
    item.source_tag_counts?.ActivitySummary
      ? `${item.source_tag_counts.ActivitySummary} activity summar${item.source_tag_counts.ActivitySummary === 1 ? "y" : "ies"}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" • ") : `${item.records_imported} imported metrics`;
}

function buildMetricMetaLine(metric: HealthMetricEntry): string | null {
  const parts = [
    metric.source_name ?? null,
    metric.device_name ?? null,
    metric.source_record_count && metric.source_record_count > 1
      ? `${metric.source_record_count} source records`
      : null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" • ") : null;
}

export default function ActivitySyncPage() {
  const { token, user, logout } = useRequiredAuth("patient");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<HealthAppProvider | "">("");
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({
    steps: "",
    active_minutes: "",
    distance_km: "",
    sleep_hours: "",
    calories: "",
  });

  const connectionsQuery = useQuery({
    queryKey: ["health-app-connections", user?.nhs_healthcare_id],
    queryFn: () => listHealthAppConnections(token!),
    enabled: Boolean(token && user),
  });

  const activityOverviewQuery = useQuery({
    queryKey: ["activity-overview", user?.nhs_healthcare_id],
    queryFn: () => getActivityOverview(token!, 30),
    enabled: Boolean(token && user),
  });

  const filesQuery = useQuery({
    queryKey: ["health-files", user?.nhs_healthcare_id],
    queryFn: () => getHealthFiles(token!),
    enabled: Boolean(token && user),
  });

  const metricsQuery = useQuery({
    queryKey: ["health-metrics-recent", user?.nhs_healthcare_id],
    queryFn: () => getHealthMetrics(token!),
    enabled: Boolean(token && user),
  });

  const profileQuery = useQuery({
    queryKey: ["agentic-profile", user?.nhs_healthcare_id, "activity-sync"],
    queryFn: () => getAgenticProfile(token!),
    enabled: Boolean(token && user),
  });

  const connectedProviders = useMemo(() => {
    const map = new Map<
      HealthAppProvider,
      { connectedAt: string; lastSyncedAt?: string | null; verified: boolean }
    >();
    for (const item of connectionsQuery.data?.items ?? []) {
      map.set(item.provider, {
        connectedAt: item.connected_at,
        lastSyncedAt: item.last_synced_at,
        verified: Boolean(item.last_synced_at),
      });
    }
    return map;
  }, [connectionsQuery.data]);

  const verifiedProviderCount = useMemo(
    () => [...connectedProviders.values()].filter((item) => item.verified).length,
    [connectedProviders],
  );
  const authoritativeSources = activityOverviewQuery.data?.authoritative_sources ?? [];
  const selectedSourceSummary = authoritativeSources.find(
    (item) => item.provider === selectedProvider,
  );

  const invalidateActivityData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["health-app-connections"] }),
      queryClient.invalidateQueries({ queryKey: ["activity-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["health-files"] }),
      queryClient.invalidateQueries({ queryKey: ["health-metrics-recent"] }),
      queryClient.invalidateQueries({ queryKey: ["agentic-profile"] }),
    ]);
  };

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) {
        throw new Error("Choose an activity export file for the selected source.");
      }
      if (!selectedProvider) {
        throw new Error("Choose Apple Health or Google Fitness before importing.");
      }
      return uploadHealthFile(token!, selectedFile, selectedProvider);
    },
    onSuccess: async (result) => {
      await invalidateActivityData();
      setSelectedFile(null);
      setUploadError(null);
      toast({
        title: "Activity imported",
        description: `${result.records_imported} records were added from ${result.filename}.`,
      });
    },
    onError: (error: Error) => {
      setUploadError(error.message);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const permissionMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateAgenticProfile(token!, {
        share_health_metrics: enabled,
      }),
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["agentic-profile"] });
      toast({
        title: profile.share_health_metrics
          ? "AI activity access enabled"
          : "AI activity access disabled",
        description: profile.share_health_metrics
          ? "CareSyncAI can now read synced steps, activity minutes, sleep, and distance."
          : "CareSyncAI will stop reading synced activity metrics.",
      });
    },
  });

  const quickLogMutation = useMutation({
    mutationFn: async () => {
      const payloads = quickMetricFields
        .map((field) => ({
          metric_type: field.metricType,
          label: field.label,
          unit: field.unit,
          rawValue: metricInputs[field.metricType].trim(),
        }))
        .filter((field) => field.rawValue.length > 0);

      if (payloads.length === 0) {
        throw new Error("Add at least one activity value before saving.");
      }

      const normalizedPayloads = payloads.map((field) => {
        const parsedValue = Number(field.rawValue);
        if (!Number.isFinite(parsedValue)) {
          throw new Error(`${field.label} must be a valid number.`);
        }

        if (parsedValue < 0) {
          throw new Error(`${field.label} cannot be negative.`);
        }

        return {
          metric_type: field.metric_type,
          unit: field.unit,
          value: parsedValue,
        };
      });

      await Promise.all(
        normalizedPayloads.map((field) =>
          logHealthMetric(token!, {
            metric_type: field.metric_type,
            unit: field.unit,
            value: field.value,
            recorded_date: manualDate,
          }),
        ),
      );
    },
    onSuccess: async () => {
      await invalidateActivityData();
      setManualError(null);
      setMetricInputs({
        steps: "",
        active_minutes: "",
        distance_km: "",
        sleep_hours: "",
        calories: "",
      });
      toast({
        title: "Activity saved",
        description: `Activity entries for ${manualDate} were added to your CareSync record.`,
      });
    },
    onError: (error: Error) => {
      setManualError(error.message);
      toast({
        title: "Could not save activity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const recentFiles = filesQuery.data?.items.slice(0, 5) ?? [];
  const recentMetrics = metricsQuery.data?.items.slice(0, 10) ?? [];

  return (
    <PatientShell
      title="Fitness Activity"
      subtitle="Bring in real movement data, review recent trends, and let CareSyncAI use it only when you allow."
      patientName={user?.full_name}
      onLogout={logout}
      workspaceMode
    >
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4 pb-8">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className={workspaceCardClassName}>
            <CardHeader className="pb-4">
              <p className={workspaceEyebrowClassName}>Fitness Sources</p>
              <CardTitle className="mt-2 text-2xl">Choose your activity source</CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Pick Apple Health or Google Fitness, then upload the real export file in this same section.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
        {providerCards.map((item) => {
                  const sourceState = connectedProviders.get(item.provider);
                  const isVerified = sourceState?.verified ?? false;
                  const isSelected = selectedProvider === item.provider;
                  const acceptedFileTypes =
                    item.provider === "apple_health" ? ".xml,.csv,.json" : ".csv,.json";
                  return (
                    <div
                      key={item.provider}
                      className={`${workspaceSoftPanelClassName} flex min-h-[250px] h-full flex-col p-4`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className={workspaceIconSurfaceClassName}>
                            <Heart className="h-4 w-4" />
                          </div>
                          <Badge
                            variant="outline"
                            className={isVerified ? workspaceAccentSoftBadgeClassName : workspaceOutlineBadgeClassName}
                          >
                            {isVerified ? "Verified by import" : "Not verified"}
                          </Badge>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                        {isVerified && sourceState?.lastSyncedAt ? (
                          <p className="mt-4 text-xs leading-5 text-slate-500">
                            Verified on {formatDateTime(sourceState.lastSyncedAt)}
                          </p>
                        ) : sourceState?.connectedAt ? (
                          <p className="mt-4 text-xs leading-5 text-amber-200/80">
                            A previous source record exists, but it is not verified yet.
                          </p>
                        ) : (
                          <p className="mt-4 text-xs leading-5 text-slate-500">
                            Source not verified yet.
                          </p>
                        )}
                      </div>

                      {isSelected ? (
                        <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
                          <div>
                            <p className={workspaceEyebrowClassName}>Upload File</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {item.provider === "apple_health"
                                ? "Upload your Apple Health `export.xml` file or a compatible CSV or JSON export to verify this source."
                                : "Upload a Google Fitness CSV or JSON export to verify this source."}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-200">Activity file</Label>
                            <Input
                              type="file"
                              accept={acceptedFileTypes}
                              className="border-white/10 bg-slate-900/80 text-slate-100 file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-amber-200"
                              onChange={(event) => {
                                setSelectedFile(event.target.files?.[0] ?? null);
                                setUploadError(null);
                              }}
                            />
                            <p className="text-xs text-slate-500">
                              {selectedFile
                                ? `Selected file: ${selectedFile.name}`
                                : `No ${item.title} file selected yet.`}
                            </p>
                            {selectedSourceSummary ? (
                              <p className="text-xs text-emerald-200/80">
                                Current source of truth: {selectedSourceSummary.days_count} day(s),{" "}
                                {selectedSourceSummary.range_start} to {selectedSourceSummary.range_end}.
                              </p>
                            ) : null}
                            {uploadError ? (
                              <p className="text-sm text-rose-300">{uploadError}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              className={workspacePrimaryButtonClassName}
                              disabled={uploadMutation.isPending}
                              onClick={() => uploadMutation.mutate()}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload {item.title} file
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={workspaceSecondaryButtonClassName}
                              onClick={() => {
                                setSelectedProvider("");
                                setSelectedFile(null);
                                setUploadError(null);
                              }}
                            >
                              Clear selection
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5">
                          <Button
                            type="button"
                            className={workspaceSecondaryButtonClassName}
                            onClick={() => {
                              setSelectedProvider(item.provider);
                              setSelectedFile(null);
                              setUploadError(null);
                            }}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {isVerified ? `Update ${item.title}` : `Select ${item.title}`}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={`${workspaceSoftPanelClassName} p-4`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Recent imports</p>
                    <p className="mt-1 text-sm text-slate-400">Your latest uploaded activity files.</p>
                  </div>
                  <Badge variant="outline" className={workspaceOutlineBadgeClassName}>
                    {recentFiles.length} shown
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {recentFiles.length === 0 ? (
                    <p className="text-sm text-slate-400">No files imported yet.</p>
                  ) : (
                    recentFiles.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm first:border-t-0 first:pt-0">
                        <div>
                          <p className="font-medium text-slate-100">{item.filename}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                          {buildImportSourceLine(item) ? (
                            <p className="mt-1 text-xs text-slate-500">{buildImportSourceLine(item)}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <Badge className={item.parsed_status === "parsed" ? workspaceAccentSoftBadgeClassName : workspaceOutlineBadgeClassName}>
                            {item.parsed_status}
                          </Badge>
                          <p className="mt-1 text-xs text-slate-500">{item.records_imported} imported metrics</p>
                          <p className="mt-1 text-xs text-slate-500">{buildImportCountLine(item)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={workspaceCardClassName}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={workspaceIconSurfaceClassName}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className={workspaceEyebrowClassName}>CareSyncAI Access</p>
                  <CardTitle className="mt-2 text-2xl">Let AI read verified activity only when you allow</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`${workspaceSoftPanelClassName} flex items-center justify-between gap-4 p-4`}>
                <div>
                  <p className="text-sm font-medium text-slate-100">Allow CareSyncAI to read activity metrics</p>
                  <p className="mt-1 text-sm text-slate-400">
                    This includes imported steps, active minutes, distance, sleep, and calorie trends.
                  </p>
                </div>
                <Switch
                  checked={profileQuery.data?.share_health_metrics ?? false}
                  disabled={permissionMutation.isPending || profileQuery.isLoading}
                  onCheckedChange={(checked) => permissionMutation.mutate(checked)}
                />
              </div>

              <div className={`${workspaceSoftPanelClassName} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-100">Source of truth</p>
                  <Badge variant="outline" className={workspaceOutlineBadgeClassName}>
                    {authoritativeSources.length} source window{authoritativeSources.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {authoritativeSources.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-400">
                      No verified Apple Health or Google Fitness dates are available yet. Upload a real export file or add a manual date.
                    </p>
                  ) : (
                    authoritativeSources.map((item) => (
                      <div key={`${item.source}-${item.provider ?? "manual"}`} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-100">{item.source_label}</p>
                          <Badge
                            variant="outline"
                            className={item.provider ? workspaceAccentSoftBadgeClassName : workspaceOutlineBadgeClassName}
                          >
                            {item.days_count} day{item.days_count === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          Authoritative for {item.range_start} to {item.range_end}
                          {item.last_synced_at ? ` • last synced ${formatDateTime(item.last_synced_at)}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`${workspaceSoftPanelClassName} space-y-3 p-4`}>
                <p className={workspaceEyebrowClassName}>Ask Better Questions</p>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>Analyze my current activity and my medical report together.</p>
                  <p>Review my steps, active minutes, and distance and tell me what to improve this week.</p>
                  <p>Based on my current activity and lab reports, how much should I increase walking or running?</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild className={workspacePrimaryButtonClassName}>
                    <Link to="/dashboard/patient/ai/medical">
                      <MessageSquareHeart className="mr-2 h-4 w-4" />
                      Open Medical AI
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className={workspaceSecondaryButtonClassName}>
                    <Link to="/dashboard/patient/ai/exercise">
                      <Dumbbell className="mr-2 h-4 w-4" />
                      Open Exercise AI
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Verified sources",
                    value: activityOverviewQuery.data?.verified_providers.length ?? verifiedProviderCount,
                  },
                  {
                    label: "Imported files",
                    value: activityOverviewQuery.data?.imported_files ?? 0,
                  },
                  {
                    label: "AI access",
                    value: profileQuery.data?.share_health_metrics ? "On" : "Off",
                  },
                ].map((item) => (
                  <div key={item.label} className={`${workspaceSoftPanelClassName} p-4`}>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className={workspaceCardClassName}>
            <CardHeader className="pb-4">
              <p className={workspaceEyebrowClassName}>Quick Log</p>
              <CardTitle className="mt-2 text-2xl">Add activity for a specific date</CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Use manual entry for dates that do not already belong to Apple Health or Google Fitness.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className={`${workspaceSoftPanelClassName} p-4`}>
                  <Label className="flex items-center gap-2 text-slate-200">
                    <CalendarDays className="h-4 w-4" />
                    Entry date
                  </Label>
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(event) => {
                      setManualDate(event.target.value);
                      setManualError(null);
                    }}
                    className="mt-3 border-white/10 bg-slate-900/80 text-slate-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    One date can belong to only one source of truth.
                  </p>
                </div>
                <div className={`${workspaceSoftPanelClassName} p-4`}>
                  <p className="text-sm font-medium text-slate-100">Manual date rule</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    If Apple Health or Google Fitness already owns {manualDate}, manual entry for that date will be rejected so the AI always reads one authoritative source.
                  </p>
                  {manualError ? <p className="mt-3 text-sm text-rose-300">{manualError}</p> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {quickMetricFields.map((field) => (
                  <div key={field.metricType} className={`${workspaceSoftPanelClassName} p-4`}>
                    <Label className="text-slate-200">{field.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={metricInputs[field.metricType]}
                      onChange={(event) =>
                        setMetricInputs((current) => ({
                          ...current,
                          [field.metricType]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className="mt-3 border-white/10 bg-slate-900/80 text-slate-100"
                    />
                    <p className="mt-2 text-xs text-slate-500">{field.unit}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className={workspacePrimaryButtonClassName}
                  disabled={quickLogMutation.isPending}
                  onClick={() => quickLogMutation.mutate()}
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Save activity for {manualDate}
                </Button>
                <p className="text-sm text-slate-400">
                  Metrics saved here will be included when CareSyncAI activity access is enabled and that date is not already owned by an imported app source.
                </p>
              </div>

              <div className={`${workspaceSoftPanelClassName} p-4`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Recent activity entries</p>
                    <p className="mt-1 text-sm text-slate-400">The latest imported or manual metrics in your record.</p>
                  </div>
                  <Badge variant="outline" className={workspaceOutlineBadgeClassName}>
                    {recentMetrics.length} shown
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {recentMetrics.length === 0 ? (
                    <p className="text-sm text-slate-400">No activity metrics available yet.</p>
                  ) : (
                    recentMetrics.map((metric) => (
                      <div key={metric.id} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm first:border-t-0 first:pt-0">
                        <div>
                          <p className="font-medium text-slate-100">
                            {metricLabels[metric.metric_type] ?? metric.metric_type}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {metric.recorded_at ? formatDateTime(metric.recorded_at) : metric.recorded_date}
                          </p>
                          {buildMetricMetaLine(metric) ? (
                            <p className="mt-1 text-xs text-slate-500">{buildMetricMetaLine(metric)}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-100">
                            {metric.value} {metric.unit}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                            {metric.source_label}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={workspaceCardClassName}>
          <CardHeader className="pb-4">
            <p className={workspaceEyebrowClassName}>Fitness Overview</p>
            <CardTitle className="mt-2 text-2xl">Last 30 days in one view</CardTitle>
            <p className="mt-2 text-sm text-slate-400">
              CareSyncAI uses these patterns to answer questions about increasing steps, activity minutes, and distance safely.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {(activityOverviewQuery.data?.metrics ?? []).map((metric) => (
                <div key={metric.metric_type} className={`${workspaceSoftPanelClassName} p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {metricLabels[metric.metric_type] ?? metric.metric_type}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        metric.trend === "up"
                          ? workspaceAccentSoftBadgeClassName
                          : workspaceOutlineBadgeClassName
                      }
                    >
                      {metric.trend}
                    </Badge>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">
                    {metric.latest_value ?? "--"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {metric.latest_recorded_date ?? "No recent data"} {metric.unit ? `• ${metric.unit}` : ""}
                  </p>
                  <div className="mt-4 space-y-1 text-sm text-slate-300">
                    <p>7-day avg: {metric.last_7_day_average ?? "--"}</p>
                    <p>Prev 7-day avg: {metric.previous_7_day_average ?? "--"}</p>
                    <p>7-day total: {metric.last_7_day_total ?? "--"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>
      </ScrollArea>
    </PatientShell>
  );
}
