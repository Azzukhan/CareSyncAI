import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Apple,
  ArrowRight,
  Dumbbell,
  Loader2,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Star,
  Trash2,
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
  accentClass: string;
  quickPrompts: string[];
  planType?: CarePlanType;
}

const panelLabels: Record<string, string> = {
  summary: "Summary",
  plan: "Plan",
  calendar: "Calendar",
  history: "History",
};

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
        glowClass: "from-cyan-500/20 via-emerald-500/10 to-slate-900",
        pillClass: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
      };
    case "diet":
      return {
        icon: Apple,
        glowClass: "from-amber-500/20 via-emerald-500/10 to-slate-900",
        pillClass: "border-amber-400/40 bg-amber-500/10 text-amber-100",
      };
    case "medical":
    default:
      return {
        icon: MessageSquareHeart,
        glowClass: "from-violet-500/20 via-cyan-500/10 to-slate-900",
        pillClass: "border-violet-400/40 bg-violet-500/10 text-violet-100",
      };
  }
}

function ConversationPanels({
  message,
  accentClass,
}: {
  message: LocalMessage;
  accentClass: string;
}) {
  const responseData = message.responseData;
  if (!responseData) return null;
  const defaultValue =
    message.preferredPanel && panelLabels[message.preferredPanel]
      ? message.preferredPanel
      : responseData.plan
        ? "plan"
        : responseData.calendar_preview.length > 0
          ? "calendar"
          : responseData.yesterday_summary
            ? "history"
            : "summary";

  return (
    <Tabs defaultValue={defaultValue} className="mt-4">
      <TabsList className="grid w-full grid-cols-4 bg-slate-950/50">
        {Object.entries(panelLabels).map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="text-[11px]">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="summary" className="mt-4 space-y-3 text-sm text-slate-200/90">
        {responseData.highlights.length > 0 ? (
          <div className="space-y-2">
            {responseData.highlights.map((item) => (
              <div key={item} className="flex gap-2">
                <ArrowRight className={cn("mt-0.5 h-4 w-4 shrink-0", accentClass)} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="plan" className="mt-4">
        {responseData.plan ? (
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
                        {[item.scheduled_day, item.meal_slot, item.target_time]
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
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No structured plan attached to this reply.</p>
        )}
      </TabsContent>

      <TabsContent value="calendar" className="mt-4">
        {responseData.calendar_preview.length > 0 ? (
          <div className="space-y-2">
            {responseData.calendar_preview.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(event.scheduled_for)}
                    {event.target_time ? ` • ${event.target_time}` : ""}
                    {event.meal_slot ? ` • ${event.meal_slot}` : ""}
                  </p>
                </div>
                {event.status ? (
                  <Badge variant="outline" className="border-white/10 text-slate-300">
                    {event.status}
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No calendar preview available for this reply.</p>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        {responseData.yesterday_summary ? (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Yesterday</p>
              <p className="mt-1 text-sm text-slate-300">
                {formatDate(responseData.yesterday_summary.date)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Planned", responseData.yesterday_summary.planned_count],
                ["Done", responseData.yesterday_summary.completed_count],
                ["Missed", responseData.yesterday_summary.missed_count],
                ["Skipped", responseData.yesterday_summary.skipped_count],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No adherence summary available yet.</p>
        )}
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
            className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
          >
            <Settings2 className="mr-2 h-4 w-4" /> Context
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-slate-950 text-slate-100 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Patient Context</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Label>Goals</Label>
            <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Allergies</Label>
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Dietary Constraints</Label>
            <Input value={constraints} onChange={(e) => setConstraints(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Pain or Injuries</Label>
            <Textarea value={pain} onChange={(e) => setPain(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Motivation Style</Label>
            <Input value={motivation} onChange={(e) => setMotivation(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Equipment Access</Label>
            <Textarea value={equipment} onChange={(e) => setEquipment(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Schedule Preferences</Label>
            <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Sleep / Work Routine</Label>
            <Textarea value={sleepRoutine} onChange={(e) => setSleepRoutine(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Plan Horizon (days)</Label>
            <Input value={planHorizon} onChange={(e) => setPlanHorizon(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Additional Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-sm font-medium">Data Consent</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Medical history</span>
                <Switch checked={shareMedicalHistory} onCheckedChange={setShareMedicalHistory} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Medications</span>
                <Switch checked={shareMedications} onCheckedChange={setShareMedications} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Health metrics</span>
                <Switch checked={shareHealthMetrics} onCheckedChange={setShareHealthMetrics} />
              </div>
            </div>
          </div>
          <Button
            className="w-full"
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
  accentClass,
  quickPrompts,
  planType,
}: AgentWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { token, user, logout } = useRequiredAuth("patient");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeConversationId, setActiveConversationId] = useState<string>(conversationId ?? "");
  const [input, setInput] = useState("");
  const [conversationSidebarOpen, setConversationSidebarOpen] = useState(true);
  const [draftConversations, setDraftConversations] = useState<Record<string, DraftConversation>>({});
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
    enabled: Boolean(token),
  });

  const conversationsQuery = useQuery({
    queryKey: ["agentic-conversations", agent],
    queryFn: () => listAgenticConversations(token!, agent),
    enabled: Boolean(token),
  });

  const detailQuery = useQuery({
    queryKey: ["agentic-conversation", activeConversationId],
    queryFn: () => getAgenticConversation(token!, activeConversationId),
    enabled: Boolean(token) && Boolean(activeConversationId) && !activeConversationId.startsWith("local_"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: Partial<PatientAgentProfile>) => updateAgenticProfile(token!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agentic-profile"] });
      toast({ title: "Patient context updated" });
    },
  });

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

  const mappedDetailMessages = useMemo(
    () => conversationMessagesToUi(detailQuery.data),
    [detailQuery.data],
  );

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteAgenticConversation(token!, id);
    },
    onSuccess: (_, deletedId) => {
      void queryClient.invalidateQueries({ queryKey: ["agentic-conversations", agent] });
      void queryClient.removeQueries({ queryKey: ["agentic-conversation", deletedId] });
      setDraftConversations((current) => {
        const updated = { ...current };
        delete updated[deletedId];
        return updated;
      });
      const fallback = mergedSummaries.find((item) => item.id !== deletedId);
      if (fallback) {
        navigate(
          fallback.id.startsWith("local_")
            ? `/dashboard/patient/ai/${agent}`
            : `/dashboard/patient/ai/${agent}/${fallback.id}`,
          { replace: true },
        );
      } else {
        navigate(`/dashboard/patient/ai/${agent}`, { replace: true });
        setActiveConversationId("");
      }
    },
  });

  const ensureDraftConversation = () => {
    const existing = activeConversationId ? draftConversations[activeConversationId] : undefined;
    if (existing) return existing.id;
    if (activeConversationId && !activeConversationId.startsWith("local_")) return activeConversationId;

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
      const existing = current[conversationKey] ?? {
        id: conversationKey,
        title: trimmed.slice(0, 48) + (trimmed.length > 48 ? "..." : ""),
        starred: false,
        updatedAt: now,
        persisted: !conversationKey.startsWith("local_"),
        messages: [],
      };
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
    setActiveConversationId(id);
    navigate(id.startsWith("local_") ? `/dashboard/patient/ai/${agent}` : `/dashboard/patient/ai/${agent}/${id}`);
  };

  const handleNewChat = () => {
    const localId = createLocalId();
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
            ? "xl:grid-cols-[17.5rem_minmax(0,1fr)]"
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
                    className="h-9 w-9 rounded-xl border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
                    onClick={() => setConversationSidebarOpen(false)}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
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
                      className="w-full justify-start border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
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
                  <div className="space-y-2">
                    {mergedSummaries.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={cn(
                          "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                          activeConversationId === conversation.id
                            ? "border-cyan-400/40 bg-cyan-400/10"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => handleSelectConversation(conversation.id)}
                          >
                            <p className="truncate text-sm font-medium text-slate-100">{conversation.title}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {conversation.message_count} turns • {timeAgo(conversation.updated_at)}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-300 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (conversation.id.startsWith("local_")) {
                                  setDraftConversations((current) => ({
                                    ...current,
                                    [conversation.id]: {
                                      ...current[conversation.id],
                                      starred: !current[conversation.id].starred,
                                    },
                                  }));
                                  return;
                                }
                                starMutation.mutate({
                                  id: conversation.id,
                                  starred: !conversation.starred,
                                });
                              }}
                            >
                              <Star
                                className={cn("h-4 w-4", conversation.starred ? "fill-current text-amber-300" : "")}
                              />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-300 hover:bg-white/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (conversation.id.startsWith("local_")) {
                                  setDraftConversations((current) => {
                                    const updated = { ...current };
                                    delete updated[conversation.id];
                                    return updated;
                                  });
                                  return;
                                }
                                deleteMutation.mutate(conversation.id);
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
                className="h-10 w-10 rounded-xl border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
                onClick={() => setConversationSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                title="New chat"
                className="h-10 w-10 rounded-2xl"
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
                    className="h-10 w-10 rounded-2xl border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
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
                        ? "border-cyan-400/40 bg-cyan-400/10 text-white"
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
                    <p className="truncate text-xs text-cyan-300/90">{activeSummary.title}</p>
                  ) : null}
                </div>
              </div>
              {planType ? (
                <NavLink
                  to={`/dashboard/patient/calendar/${planType}`}
                  className="text-sm text-cyan-300 transition-colors hover:text-cyan-200"
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
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
                        Suggested prompts
                      </p>
                      <div className="grid gap-2">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => handleSend(prompt)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.04]"
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
                          ? "border-cyan-400/30 bg-cyan-400/10 text-slate-100"
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
                          <div className="prose prose-invert mt-3 max-w-none prose-p:leading-6 prose-li:leading-6 prose-strong:text-white">
                            <ReactMarkdown>{message.text}</ReactMarkdown>
                          </div>
                          {message.sender === "assistant" ? (
                            <ConversationPanels message={message} accentClass={accentClass} />
                          ) : null}
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
                    className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10"
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
                  onClick={handleSend}
                  disabled={sendMutation.isPending || !input.trim()}
                  className="h-11 rounded-full px-5"
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
