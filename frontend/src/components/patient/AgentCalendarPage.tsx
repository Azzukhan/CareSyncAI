import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquareHeart,
} from "lucide-react";

import PatientShell from "@/components/patient/PatientShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  workspaceAccentPanelClassName,
  workspaceAccentSoftBadgeClassName,
  workspaceCardClassName,
  workspacePrimaryButtonClassName,
  workspaceSecondaryButtonClassName,
} from "@/components/workspace/workspaceTheme";
import { type AgentCalendarEvent, type CarePlanType, getAgenticCalendar } from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";

interface AgentCalendarPageProps {
  planType: CarePlanType;
  title: string;
  subtitle: string;
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildMonthGrid(currentDate: Date): Date[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
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
  if (event.duration_minutes) {
    metrics.push(`${event.duration_minutes} min`);
  }
  if (event.calories) {
    metrics.push(`${Math.round(event.calories)} kcal`);
  }
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

function DayPlanCard({
  title,
  dayKey,
  events,
  emptyMessage,
  className,
}: {
  title: string;
  dayKey: string;
  events: AgentCalendarEvent[];
  emptyMessage: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col", workspaceCardClassName, className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className={workspaceAccentSoftBadgeClassName}>
            {events.length} item{events.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium">{formatDate(dayKey)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {events.length ? "Synced from the active care plan." : emptyMessage}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">{emptyMessage}</p>
            ) : (
              events.map((event) => {
                const detailBullets = eventDetailBullets(event.details);
                const detailMetrics = eventDetailMetrics(event);
                return (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[event.meal_slot, event.target_time].filter(Boolean).join(" • ") || "Time not set"}
                        </p>
                      </div>
                      {event.status ? (
                        <Badge variant="outline" className="border-white/10 text-slate-300">
                          {event.status}
                        </Badge>
                      ) : null}
                    </div>
                    {detailMetrics.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        {detailMetrics.map((metric) => (
                          <span
                            key={`${event.id}-${metric}`}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1"
                          >
                            <Clock3 className="h-3 w-3" /> {metric}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {event.instructions ? (
                      <p className="mt-3 text-sm text-slate-300">{event.instructions}</p>
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
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function AgentCalendarPage({
  planType,
  title,
  subtitle,
}: AgentCalendarPageProps) {
  const { token, user, logout } = useRequiredAuth("patient");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));

  const monthGrid = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const startDate = toDateString(monthGrid[0]);
  const endDate = toDateString(monthGrid[monthGrid.length - 1]);

  const calendarQuery = useQuery({
    queryKey: ["agentic-calendar", planType, startDate, endDate],
    queryFn: () => getAgenticCalendar(token!, { start_date: startDate, end_date: endDate, plan_type: planType }),
    enabled: Boolean(token),
  });

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof calendarQuery.data>();
    for (const event of calendarQuery.data ?? []) {
      const existing = grouped.get(event.scheduled_for) ?? [];
      existing.push(event);
      grouped.set(event.scheduled_for, existing);
    }
    return grouped;
  }, [calendarQuery.data]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const todayKey = toDateString(new Date());
  const todayEvents = eventsByDate.get(todayKey) ?? [];
  const monthLabel = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <PatientShell
      title={title}
      subtitle={subtitle}
      patientName={user?.full_name}
      onLogout={logout}
      workspaceMode
    >
      <div className="grid h-full gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className={cn("flex h-full min-h-0 flex-col", workspaceCardClassName)}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{monthLabel}</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className={workspaceSecondaryButtonClassName}
                  onClick={() =>
                    setCurrentDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className={workspaceSecondaryButtonClassName}
                  onClick={() =>
                    setCurrentDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {calendarQuery.isLoading ? (
              <div className="flex h-full min-h-[480px] items-center justify-center text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading calendar...
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {weekdays.map((weekday) => (
                    <div key={weekday} className="px-2 py-1 text-center text-xs text-slate-500">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthGrid.map((day) => {
                    const dayKey = toDateString(day);
                    const events = eventsByDate.get(dayKey) ?? [];
                    const isSelected = selectedDate === dayKey;
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isToday = dayKey === toDateString(new Date());
                    return (
                      <button
                        key={dayKey}
                        onClick={() => setSelectedDate(dayKey)}
                        className={cn(
                          "min-h-[94px] rounded-2xl border p-2 text-left transition-colors",
                          isSelected
                            ? workspaceAccentPanelClassName
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                          !isCurrentMonth && "opacity-40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{day.getDate()}</span>
                          {isToday ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px]",
                                workspaceAccentSoftBadgeClassName,
                              )}
                            >
                              Today
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-1">
                          {events.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              className="truncate rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200"
                            >
                              {event.title}
                            </div>
                          ))}
                          {events.length > 2 ? (
                            <div className="text-[11px] text-slate-500">+{events.length - 2} more</div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-3">
          <DayPlanCard
            title="Today's Plan"
            dayKey={todayKey}
            events={todayEvents}
            emptyMessage="Nothing is scheduled for today yet."
            className={selectedDate === todayKey ? "flex-1" : undefined}
          />

          {selectedDate !== todayKey ? (
            <DayPlanCard
              title="Selected Day"
              dayKey={selectedDate}
              events={selectedEvents}
              emptyMessage="Nothing is scheduled for this date yet."
              className="max-h-[24rem]"
            />
          ) : null}

          <Card className={workspaceCardClassName}>
            <CardHeader>
              <CardTitle className="text-base">Assistant Shortcut</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to={`/dashboard/patient/ai/${planType}`}>
                <Button className={cn("w-full", workspacePrimaryButtonClassName)}>
                  <MessageSquareHeart className="mr-2 h-4 w-4" />
                  Open {planType} assistant
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PatientShell>
  );
}
