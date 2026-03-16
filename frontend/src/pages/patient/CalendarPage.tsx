import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Heart, ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, Trash2, Edit2, Dumbbell, Apple, Clock, Sparkles, Loader2, X, Brain,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  syncExerciseToCalendar, type CalendarEventEntry,
} from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const EVENT_COLORS: Record<string, string> = {
  exercise: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  diet: "bg-orange-500/20 border-orange-500/40 text-orange-400",
  appointment: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  custom: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

const EVENT_ICONS: Record<string, typeof Dumbbell> = {
  exercise: Dumbbell,
  diet: Apple,
  appointment: Clock,
  custom: CalendarIcon,
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday = 0
  for (let i = 0; i < startDay; i++) {
    days.push(new Date(year, month, -startDay + i + 1));
  }
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDate; i++) {
    days.push(new Date(year, month, i));
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }
  return days;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, token } = useRequiredAuth("patient");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("custom");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthDays = getMonthDays(year, month);

  const startDate = toDateString(monthDays[0]);
  const endDate = toDateString(monthDays[monthDays.length - 1]);

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", startDate, endDate],
    queryFn: () => getCalendarEvents(token!, { start_date: startDate, end_date: endDate }),
    enabled: isAuthenticated && Boolean(token),
  });

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createCalendarEvent>[1]) =>
      createCalendarEvent(token!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowAddForm(false);
      setNewTitle("");
      setNewType("custom");
      setNewStartTime("");
      setNewEndTime("");
      setNewDescription("");
      toast({ title: "Event created" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create event",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteCalendarEvent(token!, eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Event deleted" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return syncExerciseToCalendar(token!, toDateString(monday));
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: `Synced ${data.items.length} exercise events` });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Generate an exercise plan first.",
        variant: "destructive",
      });
    },
  });

  const events = eventsQuery.data?.items ?? [];
  const eventsByDate: Record<string, CalendarEventEntry[]> = {};
  for (const ev of events) {
    (eventsByDate[ev.event_date] ??= []).push(ev);
  }

  const today = toDateString(new Date());
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
    setSelectedDate(null);
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      event_date: selectedDate,
      event_type: newType,
      start_time: newStartTime || undefined,
      end_time: newEndTime || undefined,
      description: newDescription || undefined,
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/patient" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm hidden sm:block">Dashboard</span>
            </Link>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white">Health Calendar</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white gap-1"
            >
              {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Sync Exercises
            </Button>
            <Link to="/dashboard/patient/ai-assistant">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 gap-1">
                <Brain className="h-4 w-4" /> AI Assistant
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="text-white/60 hover:text-white hover:bg-white/10">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      {MONTHS[month]} {year}
                    </CardTitle>
                    {month !== new Date().getMonth() || year !== new Date().getFullYear() ? (
                      <Button variant="outline" size="sm" onClick={() => {
                        const now = new Date();
                        setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
                        setSelectedDate(toDateString(now));
                      }} className="h-6 px-2 text-[10px] bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition-all">
                        Today
                      </Button>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="text-white/60 hover:text-white hover:bg-white/10">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center text-xs text-white/40 py-2 font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map((d, i) => {
                    const dateStr = toDateString(d);
                    const isCurrentMonth = d.getMonth() === month;
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDate;
                    const dayEvents = eventsByDate[dateStr] ?? [];

                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedDate(dateStr); setShowAddForm(false); }}
                        className={`
                          relative h-16 sm:h-20 p-1.5 rounded-lg text-left transition-all duration-300
                          ${isCurrentMonth ? "text-white" : "text-white/20"}
                          ${isSelected ? "bg-white/15 ring-2 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-lg"}
                          ${isToday ? "bg-cyan-500/10 border border-cyan-500/30" : ""}
                        `}
                      >
                        <span className={`text-xs font-medium ${isToday ? "text-cyan-400" : ""}`}>
                          {d.getDate()}
                        </span>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                ev.event_type === "exercise" ? "bg-emerald-400" :
                                ev.event_type === "diet" ? "bg-orange-400" :
                                ev.event_type === "appointment" ? "bg-blue-400" :
                                "bg-purple-400"
                              }`}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] text-white/40">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-white/10">
                  {[
                    { type: "exercise", label: "Exercise", color: "bg-emerald-400" },
                    { type: "diet", label: "Diet", color: "bg-orange-400" },
                    { type: "appointment", label: "Appointment", color: "bg-blue-400" },
                    { type: "custom", label: "Custom", color: "bg-purple-400" },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-[10px] text-white/40">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day Detail Panel */}
          <div className="space-y-4">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selectedDate
                    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "Select a date"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedDate ? (
                  <p className="text-sm text-white/40">Click on a day to view or add events.</p>
                ) : selectedEvents.length === 0 && !showAddForm ? (
                  <p className="text-sm text-white/40">No events for this day.</p>
                ) : (
                  selectedEvents.map((ev) => {
                    const IconComp = EVENT_ICONS[ev.event_type] ?? CalendarIcon;
                    return (
                      <div
                        key={ev.id}
                        className={`p-3 rounded-xl border ${EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.custom}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <IconComp className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{ev.title}</p>
                              {ev.start_time && (
                                <p className="text-[10px] opacity-70">
                                  {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ""}
                                </p>
                              )}
                              {ev.description && (
                                <p className="text-xs opacity-60 mt-1 whitespace-pre-wrap">{ev.description}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteMutation.mutate(ev.id)}
                            className="opacity-40 hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Event Form */}
                {selectedDate && showAddForm && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">New Event</span>
                      <button onClick={() => setShowAddForm(false)}>
                        <X className="h-3 w-3 text-white/40 hover:text-white" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Event title"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    >
                      <option value="custom">Custom</option>
                      <option value="exercise">Exercise</option>
                      <option value="diet">Diet</option>
                      <option value="appointment">Appointment</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="Start"
                      />
                      <input
                        type="time"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="End"
                      />
                    </div>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <Button
                      onClick={handleAddEvent}
                      disabled={!newTitle.trim() || createMutation.isPending}
                      size="sm"
                      className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Event"}
                    </Button>
                  </div>
                )}

                {selectedDate && !showAddForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 text-white hover:bg-white/10 gap-1"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-3 w-3" /> Add Event
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
