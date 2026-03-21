import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Apple,
  Check,
  ChevronsRight,
  Dumbbell,
  Loader2,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PatientShell from "@/components/patient/PatientShell";
import {
  workspaceAccentPanelClassName,
  workspaceAccentSoftBadgeClassName,
  workspaceCardClassName,
  workspaceEyebrowClassName,
  workspaceInputClassName,
  workspacePrimaryButtonClassName,
  workspaceSecondaryButtonClassName,
  workspaceTabListClassName,
  workspaceTabTriggerClassName,
} from "@/components/workspace/workspaceTheme";
import {
  type AgentCalendarEvent,
  type AgentQueryResult,
  type CareAgentType,
  type CarePlanType,
  type ConversationDetail,
  type ConversationSummary,
  type PatientAgentProfile,
  deleteAgenticConversation,
  getAgenticConversation,
  getAgenticProfile,
  listAgenticConversations,
  queryAgenticAssistant,
  starAgenticConversation,
  updateAgenticConversation,
  updateAgenticProfile,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";

type LocalMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  createdAt: number;
  preferredPanel?: "summary" | "plan" | "calendar" | "history";
  responseData?: AgentQueryResult["data"] | null;
  isThinking?: boolean;
  error?: boolean;
};

type DraftConversation = {
  id: string;
  title: string;
  starred: boolean;
  updatedAt: number;
  messages: LocalMessage[];
  persisted: boolean;
};

interface AgentWorkspaceProps {
  agent: CareAgentType;
  title: string;
  subtitle: string;
  quickPrompts: string[];
  planType?: CarePlanType;
}

type ChatPanelKey = "summary" | "plan" | "calendar";

const panelLabels: Record<ChatPanelKey, string> = {
  summary: "Summary",
  plan: "Plan",
  calendar: "Calendar",
};

const profileFieldClassName = workspaceInputClassName;
const profileTextareaClassName = `${profileFieldClassName} min-h-[110px] resize-y`;
const profileCardClassName = cn("rounded-[26px] p-5", workspaceCardClassName);

function timeAgo(value: string | number): string {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  const delta = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function listToText(values: string[]): string {
  return values.join(", ");
}

function textToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createLocalId(): string {
  return `local_${Date.now()}_${Math.round(Math.random() * 1000)}`;
}

function isLocalConversationId(value: string): boolean {
  return value.startsWith("local_");
}

function truncateConversationTitle(title: string, maxLength = 34): string {
  const normalized = title.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function conversationMessagesToUi(detail: ConversationDetail | undefined): LocalMessage[] {
  if (!detail) return [];
  const output: LocalMessage[] = [];
  for (const message of detail.messages) {
    const createdAt = Date.parse(message.created_at);
    output.push({
      id: `${message.id}-user`,
      sender: "user",
      text: message.prompt,
      createdAt,
    });
    if (message.response_data) {
      output.push({
        id: `${message.id}-assistant`,
        sender: "assistant",
        text: message.response_data.summary,
        createdAt: createdAt + 1,
        preferredPanel: message.preferred_panel,
        responseData: message.response_data,
      });
    }
  }
  return output;
}

function latestAssistant(messages: LocalMessage[]): LocalMessage | undefined {
  return [...messages].reverse().find((message) => message.sender === "assistant" && !message.isThinking);
}

function getAgentIdentity(agent: CareAgentType) {
  switch (agent) {
    case "exercise":
      return {
        icon: Dumbbell,
        glowClass: "from-amber-500/16 via-slate-900 to-slate-900",
        pillClass: workspaceAccentSoftBadgeClassName,
      };
    case "diet":
      return {
        icon: Apple,
        glowClass: "from-amber-500/16 via-slate-900 to-slate-900",
        pillClass: workspaceAccentSoftBadgeClassName,
      };
    case "medical":
    default:
      return {
        icon: MessageSquareHeart,
        glowClass: "from-amber-500/16 via-slate-900 to-slate-900",
        pillClass: workspaceAccentSoftBadgeClassName,
      };
  }
}

function eventDetailBullets(details: Record<string, unknown> | null | undefined): string[] {
  const raw = details?.bullets;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function eventDetailMetrics(event: AgentCalendarEvent): string[] {
  const details = event.details;
  const metrics: string[] = [];
  if (event.intensity) {
    metrics.push(event.intensity);
  }
  if (typeof details?.protein_g === "number") {
    metrics.push(`${Math.round(details.protein_g)}g protein`);
  }
  if (typeof details?.carbs_g === "number") {
    metrics.push(`${Math.round(details.carbs_g)}g carbs`);
  }
  if (typeof details?.fat_g === "number") {
    metrics.push(`${Math.round(details.fat_g)}g fat`);
  }
  return metrics;
}

function ConversationPanels({
  agent,
  message,
}: {
  agent: CareAgentType;
  message: LocalMessage;
}) {
  const responseData = message.responseData;
  if (!responseData) return null;
  const totalPlanItems = responseData.plan?.items.length ?? 0;
  const visiblePanels: ChatPanelKey[] = ["summary"];
  if (agent !== "medical" && responseData.plan) {
    visiblePanels.push("plan");
  }
  if (responseData.calendar_preview.length > 0) {
    visiblePanels.push("calendar");
  }

  const defaultValue: ChatPanelKey =
    message.preferredPanel === "calendar" && visiblePanels.includes("calendar")
      ? "calendar"
      : message.preferredPanel === "plan" && visiblePanels.includes("plan")
        ? "plan"
        : "summary";

  const summaryText = responseData.summary?.trim() || message.text;
  const summaryPanel = (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      {summaryText ? (
        <div className="prose prose-invert max-w-none prose-p:leading-6 prose-li:leading-6 prose-strong:text-white">
          <ReactMarkdown>{summaryText}</ReactMarkdown>
        </div>
      ) : null}
      {responseData.highlights.length ? (
        <ul className="space-y-2 border-t border-white/10 pt-4 text-sm leading-6 text-slate-200">
          {responseData.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const planPanel = responseData.plan ? (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">{responseData.plan.title}</h4>
          <Badge variant="outline" className="border-white/20 text-slate-300">
            v{responseData.plan.version}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {formatDate(responseData.plan.start_date)}
          {responseData.plan.end_date ? ` to ${formatDate(responseData.plan.end_date)}` : ""}
        </p>
        {responseData.plan.summary ? (
          <p className="mt-2 text-sm text-slate-300">{responseData.plan.summary}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {responseData.plan.items.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-slate-400">
                  {[
                    item.scheduled_date ? formatDate(item.scheduled_date) : item.scheduled_day,
                    item.meal_slot,
                    item.target_time,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>
              {item.duration_minutes ? (
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {item.duration_minutes} min
                </Badge>
              ) : item.calories ? (
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {Math.round(item.calories)} kcal
                </Badge>
              ) : null}
            </div>
            {item.instructions ? (
              <p className="mt-2 text-xs text-slate-400">{item.instructions}</p>
            ) : null}
          </div>
        ))}
      </div>
      {totalPlanItems > 6 ? (
        <p className="text-xs text-slate-500">
          Showing the first 6 of {totalPlanItems} plan items. Open the calendar for the full schedule.
        </p>
      ) : null}
    </div>
  ) : (
    <p className="mt-4 text-sm text-slate-400">No structured plan attached to this reply.</p>
  );

  const calendarPanel = responseData.calendar_preview.length ? (
    <div className="space-y-2">
      {totalPlanItems > responseData.calendar_preview.length ? (
        <p className="text-xs text-slate-500">
          Calendar preview shows the first {responseData.calendar_preview.length} scheduled items.
        </p>
      ) : null}
      {responseData.calendar_preview.map((event) => {
        const detailBullets = eventDetailBullets(event.details);
        const detailMetrics = eventDetailMetrics(event);
        return (
          <div
            key={event.id}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-xs text-slate-400">
                  {[formatDate(event.scheduled_for), event.meal_slot, event.target_time]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              </div>
              {event.duration_minutes ? (
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {event.duration_minutes} min
                </Badge>
              ) : event.calories ? (
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {Math.round(event.calories)} kcal
                </Badge>
              ) : null}
            </div>
            {event.instructions ? (
              <p className="mt-2 text-xs text-slate-400">{event.instructions}</p>
            ) : null}
            {detailMetrics.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                {detailMetrics.map((metric) => (
                  <span
                    key={`${event.id}-${metric}`}
                    className="rounded-full border border-white/10 px-2 py-1"
                  >
                    {metric}
                  </span>
                ))}
              </div>
            ) : null}
            {detailBullets.length ? (
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {detailBullets.map((detail) => (
                  <li key={`${event.id}-${detail}`} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="mt-4 text-sm text-slate-400">No synced calendar events attached to this reply.</p>
  );

  if (visiblePanels.length === 1) {
    return <div className="mt-4">{summaryPanel}</div>;
  }

  return (
    <Tabs defaultValue={defaultValue} className="mt-4">
      <TabsList
        className={cn(
          "grid w-full",
          visiblePanels.length === 2 ? "grid-cols-2" : "grid-cols-3",
          workspaceTabListClassName,
        )}
      >
        {visiblePanels.map((value) => (
          <TabsTrigger key={value} value={value} className={cn("text-[11px]", workspaceTabTriggerClassName)}>
            {panelLabels[value]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="summary" className="mt-4">
        {summaryPanel}
      </TabsContent>

      <TabsContent value="plan" className="mt-4">
        {planPanel}
      </TabsContent>

      <TabsContent value="calendar" className="mt-4">
        {calendarPanel}
      </TabsContent>
    </Tabs>
  );
}

function ProfileSheet({
  profile,
  onSave,
  trigger,
}: {
  profile: PatientAgentProfile | undefined;
  onSave: (payload: Partial<PatientAgentProfile>) => void;
  trigger?: ReactNode;
}) {
  const [goals, setGoals] = useState("");
  const [allergies, setAllergies] = useState("");
  const [constraints, setConstraints] = useState("");
  const [pain, setPain] = useState("");
  const [motivation, setMotivation] = useState("");
  const [equipment, setEquipment] = useState("");
  const [schedule, setSchedule] = useState("");
  const [sleepRoutine, setSleepRoutine] = useState("");
  const [notes, setNotes] = useState("");
  const [shareMedicalHistory, setShareMedicalHistory] = useState(true);
  const [shareMedications, setShareMedications] = useState(true);
  const [shareHealthMetrics, setShareHealthMetrics] = useState(true);
  const [planHorizon, setPlanHorizon] = useState("28");

  useEffect(() => {
    if (!profile) return;
    setGoals(listToText(profile.goals));
    setAllergies(listToText(profile.allergies));
    setConstraints(listToText(profile.dietary_constraints));
    setPain(profile.injuries_pain_points ?? "");
    setMotivation(profile.motivation_style ?? "");
    setEquipment(profile.equipment_access ?? "");
    setSchedule(listToText(profile.schedule_preferences));
    setSleepRoutine(profile.sleep_work_routine ?? "");
    setNotes(profile.additional_notes ?? "");
    setShareMedicalHistory(profile.share_medical_history);
    setShareMedications(profile.share_medications);
    setShareHealthMetrics(profile.share_health_metrics);
    setPlanHorizon(String(profile.preferred_plan_horizon_days));
  }, [profile]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className={cn("justify-center", workspaceSecondaryButtonClassName)}
          >
            <Settings2 className="mr-2 h-4 w-4" /> Context
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_rgba(2,6,23,0.96)_38%)] text-slate-100 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Patient Context</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="rounded-[28px] border border-amber-400/20 bg-slate-950/55 p-5 shadow-[0_18px_48px_rgba(211,177,77,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              CareSync Context Studio
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Shape what the agent sees about your goals, routine, and consent settings. Use commas
              for short lists and fuller notes where nuance matters.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className={profileCardClassName}>
              <div className="mb-4">
                <p className={workspaceEyebrowClassName}>
                  Health Priorities
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Tell the assistant what to prioritize, avoid, and monitor.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-slate-200">Goals</Label>
                  <Textarea
                    className={profileTextareaClassName}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="Lower stress, improve asthma control, feel stronger by summer"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Allergies</Label>
                  <Input
                    className={profileFieldClassName}
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Shellfish, penicillin"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Dietary Constraints</Label>
                  <Input
                    className={profileFieldClassName}
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="Low sodium, dairy-free, vegetarian"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Pain or Injuries</Label>
                  <Textarea
                    className={profileTextareaClassName}
                    value={pain}
                    onChange={(e) => setPain(e.target.value)}
                    placeholder="Lower back tightness after long walks, right shoulder strain"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Additional Notes</Label>
                  <Textarea
                    className={profileTextareaClassName}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Upcoming GP visit, medication changes, special concerns"
                  />
                </div>
              </div>
            </section>

            <section className={profileCardClassName}>
              <div className="mb-4">
                <p className={workspaceEyebrowClassName}>
                  Routine Design
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Help the assistant fit recommendations into your real-life schedule.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-slate-200">Motivation Style</Label>
                  <Input
                    className={profileFieldClassName}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    placeholder="Gentle encouragement, short checklists, direct coaching"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Equipment Access</Label>
                  <Textarea
                    className={profileTextareaClassName}
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                    placeholder="Walking shoes, yoga mat, resistance bands, no gym access"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Schedule Preferences</Label>
                  <Input
                    className={profileFieldClassName}
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Weekday mornings, lunch break, after 7 PM"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Sleep / Work Routine</Label>
                  <Textarea
                    className={profileTextareaClassName}
                    value={sleepRoutine}
                    onChange={(e) => setSleepRoutine(e.target.value)}
                    placeholder="Sleep at 11 PM, school run at 8 AM, office 9 to 5"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-200">Plan Horizon (days)</Label>
                  <Input
                    className={profileFieldClassName}
                    value={planHorizon}
                    onChange={(e) => setPlanHorizon(e.target.value)}
                    placeholder="28"
                  />
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[28px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.36)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={workspaceEyebrowClassName}>
                  Data Consent
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Choose which protected context the AI can use while generating guidance.
                </p>
              </div>
              <Badge variant="outline" className={workspaceAccentSoftBadgeClassName}>
                {profile?.completeness_score ?? 0}% context ready
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  label: "Medical history",
                  description: "Conditions, visits, and clinical background.",
                  checked: shareMedicalHistory,
                  onCheckedChange: setShareMedicalHistory,
                },
                {
                  label: "Medications",
                  description: "Prescriptions and active treatment context.",
                  checked: shareMedications,
                  onCheckedChange: setShareMedications,
                },
                {
                  label: "Activity and metrics",
                  description: "Steps, activity, sleep, and other tracked health data.",
                  checked: shareHealthMetrics,
                  onCheckedChange: setShareHealthMetrics,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                    </div>
                    <Switch checked={item.checked} onCheckedChange={item.onCheckedChange} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Button
            className={cn("w-full rounded-2xl", workspacePrimaryButtonClassName)}
            onClick={() =>
              onSave({
                goals: textToList(goals),
                allergies: textToList(allergies),
                injuries_pain_points: pain,
                dietary_constraints: textToList(constraints),
                motivation_style: motivation,
                equipment_access: equipment,
                schedule_preferences: textToList(schedule),
                sleep_work_routine: sleepRoutine,
                preferred_plan_horizon_days: Number(planHorizon) || 28,
                additional_notes: notes,
                share_medical_history: shareMedicalHistory,
                share_medications: shareMedications,
                share_health_metrics: shareHealthMetrics,
              })
            }
          >
            Save Context
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AgentWorkspace({
  agent,
  title,
  subtitle,
  quickPrompts,
  planType,
}: AgentWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { isAuthenticated, token, user, logout } = useRequiredAuth("patient");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeConversationId, setActiveConversationId] = useState<string>(conversationId ?? "");
  const [input, setInput] = useState("");
  const [conversationSidebarOpen, setConversationSidebarOpen] = useState(true);
  const [draftConversations, setDraftConversations] = useState<Record<string, DraftConversation>>({});
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const agentIdentity = useMemo(() => getAgentIdentity(agent), [agent]);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      return;
    }
    setActiveConversationId((current) => (current.startsWith("local_") ? current : ""));
  }, [conversationId]);

  const profileQuery = useQuery({
    queryKey: ["agentic-profile"],
    queryFn: () => getAgenticProfile(token!),
    enabled: isAuthenticated && Boolean(token),
  });

  const conversationsQuery = useQuery({
    queryKey: ["agentic-conversations", agent],
    queryFn: () => listAgenticConversations(token!, agent),
    enabled: isAuthenticated && Boolean(token),
  });

  const detailQuery = useQuery({
    queryKey: ["agentic-conversation", activeConversationId],
    queryFn: () => getAgenticConversation(token!, activeConversationId),
    enabled:
      isAuthenticated &&
      Boolean(token) &&
      Boolean(activeConversationId) &&
      !activeConversationId.startsWith("local_"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: Partial<PatientAgentProfile>) => updateAgenticProfile(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agentic-profile"] });
      toast({ title: "Patient context updated" });
    },
  });

  const setDraftConversation = (
    conversationId: string,
    updater: (draft: DraftConversation | undefined) => DraftConversation | undefined,
  ) => {
    setDraftConversations((current) => {
      const nextValue = updater(current[conversationId]);
      if (!nextValue) {
        if (!(conversationId in current)) {
          return current;
        }
        const updated = { ...current };
        delete updated[conversationId];
        return updated;
      }
      return {
        ...current,
        [conversationId]: nextValue,
      };
    });
  };

  const mergedSummaries = useMemo(() => {
    const remote = conversationsQuery.data ?? [];
    const remoteIds = new Set(remote.map((item) => item.id));
    const draftSummaries: ConversationSummary[] = Object.values(draftConversations)
      .filter((draft) => !remoteIds.has(draft.id))
      .map((draft) => ({
        id: draft.id,
        agent,
        title: draft.title,
        starred: draft.starred,
        updated_at: new Date(draft.updatedAt).toISOString(),
        message_count: draft.messages.filter((message) => message.sender === "assistant").length,
      }));
    return [...remote, ...draftSummaries].sort(
      (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
    );
  }, [agent, conversationsQuery.data, draftConversations]);

  useEffect(() => {
    if (activeConversationId || mergedSummaries.length === 0) return;
    setActiveConversationId(mergedSummaries[0].id);
    navigate(
      mergedSummaries[0].id.startsWith("local_")
        ? `/dashboard/patient/ai/${agent}`
        : `/dashboard/patient/ai/${agent}/${mergedSummaries[0].id}`,
      { replace: true },
    );
  }, [activeConversationId, agent, mergedSummaries, navigate]);

  useEffect(() => {
    if (!editingConversationId) {
      return;
    }
    const nextTitle = mergedSummaries.find((item) => item.id === editingConversationId)?.title;
    if (!nextTitle) {
      setEditingConversationId(null);
      setTitleDraft("");
    }
  }, [editingConversationId, mergedSummaries]);

  const mappedDetailMessages = useMemo(
    () => conversationMessagesToUi(detailQuery.data),
    [detailQuery.data],
  );

  useEffect(() => {
    if (!detailQuery.data) return;
    const conversationId = detailQuery.data.id;
    setDraftConversation(conversationId, (draft) => {
      if (!draft || draft.messages.some((message) => message.isThinking)) {
        return draft;
      }
      return {
        ...draft,
        title: detailQuery.data.title,
        starred: detailQuery.data.starred,
        updatedAt: Date.parse(detailQuery.data.updated_at),
        messages: conversationMessagesToUi(detailQuery.data),
      };
    });
  }, [detailQuery.data]);

  const activeMessages = useMemo(() => {
    if (!activeConversationId) return [] as LocalMessage[];
    const draft = draftConversations[activeConversationId];
    if (draft) return draft.messages;
    return mappedDetailMessages;
  }, [activeConversationId, draftConversations, mappedDetailMessages]);

  const latestReply = latestAssistant(activeMessages);
  const activeSummary = useMemo(
    () => mergedSummaries.find((item) => item.id === activeConversationId),
    [activeConversationId, mergedSummaries],
  );
  const activeConversationTitle = activeSummary?.title ?? "";
  const activeConversationTitlePreview = activeConversationTitle
    ? truncateConversationTitle(activeConversationTitle, 36)
    : "";

  const syncConversationSummaryCache = (summary: ConversationSummary) => {
    queryClient.setQueryData<ConversationSummary[] | undefined>(
      ["agentic-conversations", agent],
      (current) => current?.map((item) => (item.id === summary.id ? summary : item)) ?? current,
    );
    queryClient.setQueryData<ConversationDetail | undefined>(
      ["agentic-conversation", summary.id],
      (current) =>
        current
          ? {
              ...current,
              title: summary.title,
              starred: summary.starred,
              updated_at: summary.updated_at,
            }
          : current,
    );
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const sendMutation = useMutation({
    mutationFn: async (input: { prompt: string; conversationKey: string }) =>
      queryAgenticAssistant(token!, {
        prompt: input.prompt,
        agent,
        conversation_id:
          input.conversationKey && !input.conversationKey.startsWith("local_")
            ? input.conversationKey
            : undefined,
      }),
    onSuccess: async (result, variables) => {
      const now = Date.now();
      const nextId = result.conversation_id;
      const previousId = variables.conversationKey;
      setDraftConversations((current) => {
        const existing = current[previousId] ?? current[nextId];
        const withoutThinking = (existing?.messages ?? []).filter((message) => !message.isThinking);
        const nextDraft: DraftConversation = {
          id: nextId,
          title:
            existing?.title ??
            variables.prompt.slice(0, 48) + (variables.prompt.length > 48 ? "..." : ""),
          starred: existing?.starred ?? false,
          updatedAt: now,
          persisted: true,
          messages: [
            ...withoutThinking,
            {
              id: `${nextId}-assistant-${now}`,
              sender: "assistant",
              text: result.response,
              createdAt: now,
              preferredPanel: result.preferred_panel,
              responseData: result.data,
            },
          ],
        };
        const updated = { ...current };
        delete updated[previousId];
        updated[nextId] = nextDraft;
        return updated;
      });
      setInput("");
      setActiveConversationId(nextId);
      navigate(`/dashboard/patient/ai/${agent}/${nextId}`, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
      await queryClient.invalidateQueries({ queryKey: ["agentic-conversation", nextId] });
      await queryClient.invalidateQueries({ queryKey: ["agentic-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["agentic-calendar"] });
      toast({ title: `${title} updated` });
    },
    onError: (error, variables) => {
      const now = Date.now();
      const conversationKey = variables.conversationKey;
      setDraftConversations((current) => {
        const existing = current[conversationKey];
        if (!existing) return current;
        return {
          ...current,
          [conversationKey]: {
            ...existing,
            updatedAt: now,
            messages: [
              ...existing.messages.filter((message) => !message.isThinking),
              {
                id: `${conversationKey}-error-${now}`,
                sender: "assistant",
                text: `I couldn't process "${variables.prompt}" right now. Please try again.`,
                createdAt: now,
                error: true,
              },
            ],
          },
        };
      });
      toast({
        title: "Unable to send message",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const starMutation = useMutation({
    mutationFn: async (input: { id: string; starred: boolean }) => {
      await starAgenticConversation(token!, input.id, input.starred);
    },
    onSuccess: (_, variables) => {
      setDraftConversation(variables.id, (draft) =>
        draft
          ? {
              ...draft,
              starred: variables.starred,
              updatedAt: Date.now(),
            }
          : draft,
      );
      if (activeSummary && activeSummary.id === variables.id) {
        syncConversationSummaryCache({
          ...activeSummary,
          starred: variables.starred,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string }) =>
      updateAgenticConversation(token!, payload.id, { title: payload.title }),
    onSuccess: (updatedConversation) => {
      setDraftConversation(updatedConversation.id, (draft) =>
        draft
          ? {
              ...draft,
              title: updatedConversation.title,
            }
          : draft,
      );
      syncConversationSummaryCache(updatedConversation);
      void queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
      setEditingConversationId(null);
      setTitleDraft("");
      toast({ title: "Conversation title updated" });
    },
    onError: (error) => {
      toast({
        title: "Unable to update title",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteAgenticConversation(token!, id);
    },
    onSuccess: (_, deletedId) => {
      void queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
      void queryClient.removeQueries({ queryKey: ["agentic-conversation", deletedId] });
      setDraftConversation(deletedId, () => undefined);
      if (editingConversationId === deletedId) {
        setEditingConversationId(null);
        setTitleDraft("");
      }

      if (activeConversationId === deletedId) {
        const fallback = mergedSummaries.find((item) => item.id !== deletedId);
        if (fallback) {
          setActiveConversationId(fallback.id);
          navigate(
            isLocalConversationId(fallback.id)
              ? `/dashboard/patient/ai/${agent}`
              : `/dashboard/patient/ai/${agent}/${fallback.id}`,
            { replace: true },
          );
        } else {
          navigate(`/dashboard/patient/ai/${agent}`, { replace: true });
          setActiveConversationId("");
        }
      }
      toast({ title: "Conversation archived" });
    },
  });

  const ensureDraftConversation = () => {
    const existing = activeConversationId ? draftConversations[activeConversationId] : undefined;
    if (existing) return existing.id;
    if (activeConversationId && !isLocalConversationId(activeConversationId)) return activeConversationId;

    const localId = activeConversationId || createLocalId();
    setDraftConversations((current) => ({
      ...current,
      [localId]: {
        id: localId,
        title: `New ${title}`,
        starred: false,
        updatedAt: Date.now(),
        persisted: false,
        messages: [],
      },
    }));
    if (!activeConversationId) {
      setActiveConversationId(localId);
    }
    return localId;
  };

  const handleSend = (promptOverride?: string) => {
    const trimmed = (promptOverride ?? input).trim();
    if (!trimmed || sendMutation.isPending) return;
    const conversationKey = ensureDraftConversation();
    const now = Date.now();
    setDraftConversations((current) => {
      const existing =
        current[conversationKey] ??
        (!isLocalConversationId(conversationKey) && activeConversationId === conversationKey
          ? {
              id: conversationKey,
              title:
                activeSummary?.title ??
                trimmed.slice(0, 48) + (trimmed.length > 48 ? "..." : ""),
              starred: activeSummary?.starred ?? false,
              updatedAt: now,
              persisted: true,
              messages: activeMessages.filter((message) => !message.isThinking),
            }
          : {
              id: conversationKey,
              title: trimmed.slice(0, 48) + (trimmed.length > 48 ? "..." : ""),
              starred: false,
              updatedAt: now,
              persisted: !isLocalConversationId(conversationKey),
              messages: [],
            });
      return {
        ...current,
        [conversationKey]: {
          ...existing,
          title:
            existing.title.startsWith("New ")
              ? trimmed.slice(0, 48) + (trimmed.length > 48 ? "..." : "")
              : existing.title,
          updatedAt: now,
          messages: [
            ...existing.messages,
            { id: `${conversationKey}-user-${now}`, sender: "user", text: trimmed, createdAt: now },
            {
              id: `${conversationKey}-thinking-${now}`,
              sender: "assistant",
              text: "Thinking...",
              createdAt: now + 1,
              isThinking: true,
            },
          ],
        },
      };
    });
    sendMutation.mutate({ prompt: trimmed, conversationKey });
  };

  const handleSelectConversation = (id: string) => {
    setEditingConversationId(null);
    setTitleDraft("");
    setActiveConversationId(id);
    navigate(isLocalConversationId(id) ? `/dashboard/patient/ai/${agent}` : `/dashboard/patient/ai/${agent}/${id}`);
  };

  const handleNewChat = () => {
    const localId = createLocalId();
    setEditingConversationId(null);
    setTitleDraft("");
    setDraftConversations((current) => ({
      ...current,
      [localId]: {
        id: localId,
        title: `New ${title}`,
        starred: false,
        updatedAt: Date.now(),
        persisted: false,
        messages: [],
      },
    }));
    setActiveConversationId(localId);
    navigate(`/dashboard/patient/ai/${agent}`);
  };

  const handleToggleConversationStar = (conversation: ConversationSummary) => {
    if (isLocalConversationId(conversation.id)) {
      setDraftConversation(conversation.id, (draft) =>
        draft
          ? {
              ...draft,
              starred: !draft.starred,
              updatedAt: Date.now(),
            }
          : draft,
      );
      return;
    }
    starMutation.mutate({
      id: conversation.id,
      starred: !conversation.starred,
    });
  };

  const handleDeleteConversation = (conversation: ConversationSummary) => {
    if (isLocalConversationId(conversation.id)) {
      setDraftConversation(conversation.id, () => undefined);
      if (editingConversationId === conversation.id) {
        setEditingConversationId(null);
        setTitleDraft("");
      }
      if (activeConversationId === conversation.id) {
        const fallback = mergedSummaries.find((item) => item.id !== conversation.id);
        if (fallback) {
          setActiveConversationId(fallback.id);
          navigate(
            isLocalConversationId(fallback.id)
              ? `/dashboard/patient/ai/${agent}`
              : `/dashboard/patient/ai/${agent}/${fallback.id}`,
            { replace: true },
          );
        } else {
          setActiveConversationId("");
          navigate(`/dashboard/patient/ai/${agent}`, { replace: true });
        }
      }
      return;
    }

    deleteMutation.mutate(conversation.id);
  };

  const handleStartTitleEdit = (conversation: ConversationSummary) => {
    if (activeConversationId !== conversation.id) {
      handleSelectConversation(conversation.id);
    }
    setEditingConversationId(conversation.id);
    setTitleDraft(conversation.title);
  };

  const handleCancelTitleEdit = () => {
    setEditingConversationId(null);
    setTitleDraft("");
  };

  const handleSaveConversationTitle = () => {
    if (!activeSummary) {
      return;
    }
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toast({
        title: "Title is required",
        description: "Use at least one visible character.",
        variant: "destructive",
      });
      return;
    }
    if (trimmed === activeSummary.title.trim()) {
      handleCancelTitleEdit();
      return;
    }
    if (isLocalConversationId(activeSummary.id)) {
      setDraftConversation(activeSummary.id, (draft) =>
        draft
          ? {
              ...draft,
              title: trimmed,
              updatedAt: Date.now(),
            }
          : draft,
      );
      handleCancelTitleEdit();
      return;
    }
    updateTitleMutation.mutate({ id: activeSummary.id, title: trimmed });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PatientShell
      title={title}
      subtitle={subtitle}
      patientName={user?.full_name}
      onLogout={logout}
      hideContentHeader
      workspaceMode
    >
      <div
        className={cn(
          "grid h-full gap-0 xl:grid-cols-[minmax(0,1fr)]",
          conversationSidebarOpen
            ? "xl:grid-cols-[19rem_minmax(0,1fr)]"
            : "xl:grid-cols-[4.75rem_minmax(0,1fr)]",
        )}
      >
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0 border-r border-white/10 bg-slate-950/55 shadow-none">
          {conversationSidebarOpen ? (
            <>
              <CardHeader className="space-y-3 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base text-slate-100">Conversations</CardTitle>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Collapse sidebar"
                    className={cn("h-9 w-9 rounded-xl", workspaceSecondaryButtonClassName)}
                    onClick={() => setConversationSidebarOpen(false)}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full", workspaceSecondaryButtonClassName)}
                  onClick={handleNewChat}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New chat
                </Button>
                <ProfileSheet
                  profile={profileQuery.data}
                  onSave={(payload) => updateProfileMutation.mutate(payload)}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-center", workspaceSecondaryButtonClassName)}
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      Context
                    </Button>
                  }
                />
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Context readiness</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {profileQuery.data?.completeness_score ?? 0}% complete
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 pt-4">
                <ScrollArea className="h-full pr-2">
                  <div className="space-y-2.5">
                    {mergedSummaries.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={cn(
                          "w-full rounded-[20px] border px-3.5 py-3 text-left shadow-[0_12px_30px_rgba(2,6,23,0.16)] transition-colors",
                          activeConversationId === conversation.id
                            ? workspaceAccentPanelClassName
                            : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]",
                        )}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2">
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => handleSelectConversation(conversation.id)}
                          >
                            <p className="truncate text-sm font-semibold leading-5 text-slate-100">
                              {truncateConversationTitle(conversation.title, 24)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {conversation.message_count} turns • {timeAgo(conversation.updated_at)}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-slate-950/55 p-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title={conversation.starred ? "Unstar conversation" : "Star conversation"}
                              className="h-6 w-6 rounded-full text-slate-300 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleConversationStar(conversation);
                              }}
                            >
                              <Star
                                className={cn("h-3.5 w-3.5", conversation.starred ? "fill-current text-amber-300" : "")}
                              />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Rename conversation"
                              className="h-6 w-6 rounded-full text-slate-300 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleStartTitleEdit(conversation);
                              }}
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Archive conversation"
                              className="h-6 w-6 rounded-full text-rose-300 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteConversation(conversation);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {mergedSummaries.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                        Start a new chat to build your {title.toLowerCase()} history.
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-full min-h-0 flex-col items-center gap-3 px-3 py-4">
              <Button
                type="button"
                size="icon"
                variant="outline"
                title="Expand sidebar"
                className={cn("h-10 w-10 rounded-xl", workspaceSecondaryButtonClassName)}
                onClick={() => setConversationSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
                <Button
                  type="button"
                  size="icon"
                  title="New chat"
                  className={cn("h-10 w-10 rounded-2xl", workspacePrimaryButtonClassName)}
                  onClick={handleNewChat}
                >
                <Plus className="h-4 w-4" />
              </Button>
              <ProfileSheet
                profile={profileQuery.data}
                onSave={(payload) => updateProfileMutation.mutate(payload)}
                trigger={
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Context"
                    className={cn("h-10 w-10 rounded-2xl", workspaceSecondaryButtonClassName)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                }
              />
              <div className="mt-1 flex flex-col gap-2">
                {mergedSummaries.slice(0, 6).map((conversation) => (
                  <Button
                    key={conversation.id}
                    type="button"
                    size="icon"
                    variant="ghost"
                    title={conversation.title}
                    className={cn(
                      "h-10 w-10 rounded-2xl border",
                      activeConversationId === conversation.id
                        ? workspaceAccentPanelClassName
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                    )}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <span className="text-xs font-semibold">
                      {conversation.title.trim().slice(0, 1).toUpperCase() || "C"}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 border-l-0 border-white/10 bg-slate-950/45 shadow-none">
          <div className="border-b border-white/10 bg-slate-900/40 px-5 py-4 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br text-slate-100",
                    agentIdentity.glowClass,
                  )}
                >
                  <agentIdentity.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-slate-100">{title}</h2>
                  <p className="truncate text-sm text-slate-400">{subtitle}</p>
                  {activeSummary ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      {editingConversationId === activeSummary.id ? (
                        <div className="flex min-w-[18rem] max-w-full items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-2 py-2">
                          <Input
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleSaveConversationTitle();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                handleCancelTitleEdit();
                              }
                            }}
                            className="h-9 border-white/10 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-500"
                            placeholder="Rename this chat"
                          />
                          <Button
                            type="button"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            onClick={handleSaveConversationTitle}
                            disabled={updateTitleMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className={cn("h-9 w-9 rounded-xl", workspaceSecondaryButtonClassName)}
                            onClick={handleCancelTitleEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex max-w-full items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                              Chat
                            </span>
                            <span className="max-w-[17rem] truncate text-sm font-medium text-slate-100">
                              {activeConversationTitlePreview}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/55 p-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title={activeSummary.starred ? "Unstar conversation" : "Star conversation"}
                              className="h-8 w-8 rounded-full border-0 bg-transparent text-slate-200 hover:bg-white/10"
                              onClick={() => handleToggleConversationStar(activeSummary)}
                            >
                              <Star
                                className={cn("h-4 w-4", activeSummary.starred ? "fill-current text-amber-300" : "")}
                              />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title="Rename conversation"
                              className="h-8 w-8 rounded-full border-0 bg-transparent text-slate-200 hover:bg-white/10"
                              onClick={() => handleStartTitleEdit(activeSummary)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title="Archive conversation"
                              className="h-8 w-8 rounded-full border-0 bg-transparent text-rose-200 hover:bg-rose-500/20"
                              onClick={() => handleDeleteConversation(activeSummary)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              {planType ? (
                <NavLink
                  to={`/dashboard/patient/calendar/${planType}`}
                  className="text-sm text-amber-300 transition-colors hover:text-amber-200"
                >
                  Open {planType} calendar
                </NavLink>
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {activeMessages.length === 0 ? (
              <div className="grid min-h-full place-items-center px-6 py-8">
                <div className="w-full max-w-3xl">
                  <div className="mb-4 flex justify-center">
                    <div
                      className={cn(
                        "rounded-full border px-5 py-2 text-sm font-semibold shadow-[0_0_50px_rgba(56,189,248,0.14)]",
                        agentIdentity.pillClass,
                      )}
                    >
                      {title}
                    </div>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                    <p className="text-lg font-semibold text-slate-100">Start with a prompt</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Ask for revisions, summaries, calendar changes, or yesterday feedback.
                    </p>
                    <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
                        Suggested prompts
                      </p>
                      <div className="grid gap-2">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handleSend(prompt)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:border-amber-400/30 hover:bg-white/[0.04]"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 px-5 py-5">
                {activeMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[28px] border px-4 py-3 shadow-sm",
                        message.sender === "user"
                          ? "border-amber-400/30 bg-amber-400/10 text-slate-100"
                          : message.error
                            ? "border-rose-400/30 bg-rose-400/10 text-slate-100"
                            : "border-white/10 bg-white/[0.04] text-slate-100",
                      )}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        <span>{message.sender === "user" ? "You" : title}</span>
                        <span>•</span>
                        <span>{timeAgo(message.createdAt)}</span>
                      </div>
                      {message.isThinking ? (
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking through your request...
                        </div>
                      ) : (
                        <>
                          {message.sender === "assistant" && message.responseData ? (
                            <ConversationPanels agent={agent} message={message} />
                          ) : (
                            <div className="prose prose-invert mt-3 max-w-none prose-p:leading-6 prose-li:leading-6 prose-strong:text-white">
                              <ReactMarkdown>{message.text}</ReactMarkdown>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {latestReply?.responseData?.suggested_follow_ups?.length ? (
            <div className="border-t border-white/10 px-6 py-3">
              <div className="flex flex-wrap gap-2">
                {latestReply.responseData.suggested_follow_ups.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant="outline"
                    className={workspaceSecondaryButtonClassName}
                    onClick={() => handleSend(item)}
                  >
                    <ChevronsRight className="mr-1 h-3 w-3" />
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-white/10 px-4 py-4">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-3">
              <div className="flex items-end gap-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[60px] border-0 bg-transparent text-slate-100 shadow-none placeholder:text-slate-500 focus-visible:ring-0"
                  placeholder="Ask about what changed, what you missed yesterday, or what needs to improve."
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={sendMutation.isPending || !input.trim()}
                  className={cn("h-11 rounded-full px-5", workspacePrimaryButtonClassName)}
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PatientShell>
  );
}
