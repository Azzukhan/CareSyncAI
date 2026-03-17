import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Brain, Calendar, Dumbbell, HeartPulse, Activity,
  Info, AlertTriangle, TrendingUp
} from "lucide-react";
import { generateExercisePlan, syncExerciseToCalendar, type ExerciseSchedule } from "@/lib/api";
import { workspacePrimaryButtonClassName } from "@/components/workspace/workspaceTheme";
import { useRequiredAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function ExercisePlanner() {
  const { isAuthenticated, token, user, logout } = useRequiredAuth("patient");
  const { toast } = useToast();
  
  // Form State
  const [fitnessLevel, setFitnessLevel] = useState("Beginner");
  const [goals, setGoals] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionDuration, setSessionDuration] = useState("30");
  
  // Data Sharing State
  const [shareMedicalHistory, setShareMedicalHistory] = useState(true);
  const [shareMedications, setShareMedications] = useState(true);
  const [shareHealthMetrics, setShareHealthMetrics] = useState(true);

  // Result State
  const [planResult, setPlanResult] = useState<{ schedules: ExerciseSchedule[], summary: string } | null>(null);

  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const toggleDay = (day: string) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      return generateExercisePlan(token, {
        fitness_level: fitnessLevel,
        goals,
        available_days: availableDays.length > 0 ? availableDays : ["Monday", "Wednesday", "Friday"],
        session_duration_minutes: parseInt(sessionDuration, 10),
      });
    },
    onSuccess: (data) => {
      setPlanResult({ schedules: data.items, summary: data.ai_summary });
      toast({ title: "Exercise plan generated successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      return syncExerciseToCalendar(token, new Date().toISOString().split('T')[0]);
    },
    onSuccess: () => {
      toast({ title: "Exercises synced to calendar!" });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/patient/ai-assistant">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 shadow-lg">
              <Dumbbell className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Exercise Planner</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Brain className="h-3 w-3" /> Powered by CareSync AI
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
        {/* Left Sidebar: Controls */}
        <div className="space-y-6">
          <Card className="border-primary/10 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                Data Shared with AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Medical History</label>
                <Switch checked={shareMedicalHistory} onCheckedChange={setShareMedicalHistory} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Medications</label>
                <Switch checked={shareMedications} onCheckedChange={setShareMedications} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Health Metrics</label>
                <Switch checked={shareHealthMetrics} onCheckedChange={setShareHealthMetrics} />
              </div>
              <p className="text-[10px] text-muted-foreground pt-2 border-t">
                The AI needs your medical context to generate safe, medically-aware exercise recommendations tailored for you.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fitness Level</label>
                <select 
                  value={fitnessLevel}
                  onChange={(e) => setFitnessLevel(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Rehabilitation">Rehabilitation / Recovery</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Session Duration</label>
                <select 
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="15">15 minutes (Quick)</option>
                  <option value="30">30 minutes (Standard)</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes (Extended)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Specific Goals (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. improve stamina, lose weight, knee-safe"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex justify-between">
                  Available Days <span>{availableDays.length}/7</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-2 py-1 text-[11px] rounded-full border transition-colors ${
                        availableDays.includes(day) 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                className={`mt-4 w-full ${workspacePrimaryButtonClassName}`}
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? "Analyzing Profile..." : "Generate AI Plan"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Results */}
        <div className="space-y-6">
          {/* Loading State */}
          {generateMutation.isPending && (
            <Card className="border-primary/20 bg-background/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
                  <div className="absolute inset-2 flex items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 animate-pulse">
                    <Brain className="h-8 w-8 animate-bounce text-amber-300" />
                  </div>
                </div>
                <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent animate-pulse">
                  Synthesizing Medical Data...
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Reviewing {shareMedicalHistory ? "medical history, " : ""} 
                  {shareMedications ? "medications, " : ""}
                  and matching safe exercises to your {fitnessLevel.toLowerCase()} fitness level.
                </p>
                <div className="w-full space-y-3 mt-6">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Initial State (Empty) */}
          {!generateMutation.isPending && !planResult && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed bg-muted/30">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Dumbbell className="h-10 w-10 text-primary/40" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ready to move?</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                Our AI will analyze your health profile and create a safe, personalized weekly exercise schedule that matches your goals.
              </p>
              <Button onClick={() => generateMutation.mutate()} variant="outline">
                Generate My Plan
              </Button>
            </div>
          )}

          {/* Result State */}
          {!generateMutation.isPending && planResult && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* AI Summary Header */}
              <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">AI Assessment</h3>
                      <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed">
                        {planResult.summary.split('\n').map((line, i) => {
                          if (line.includes("⚠️ Safety:")) {
                            return (
                              <div key={i} className="flex gap-2 items-start mt-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-700 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <p className="m-0 text-sm">{line.replace("⚠️ Safety:", "").trim()}</p>
                              </div>
                            );
                          }
                          if (line.includes("📈 Progression:")) {
                            return (
                              <div key={i} className="flex gap-2 items-start mt-4 mb-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 dark:text-blue-400">
                                <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
                                <p className="m-0 text-sm">{line.replace("📈 Progression:", "").trim()}</p>
                              </div>
                            );
                          }
                          if (line.trim()) {
                            return <p key={i}>{line}</p>;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Your Weekly Schedule</h2>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <Calendar className="h-4 w-4" />
                  {syncMutation.isPending ? "Syncing..." : "Sync to Calendar"}
                </Button>
              </div>

              {/* Schedule List */}
              <div className="space-y-3">
                {planResult.schedules.map((schedule, i) => (
                  <Card key={i} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex">
                      {/* Left: Day Badge */}
                      <div className="w-24 bg-muted flex flex-col items-center justify-center p-3 border-r">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          {schedule.day_of_week.slice(0, 3)}
                        </span>
                        <span className="text-sm font-medium">Day {i + 1}</span>
                      </div>
                      
                      {/* Right: Content */}
                      <div className="p-4 flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg">{schedule.exercise_name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border
                            ${schedule.intensity === 'low' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                            ${schedule.intensity === 'moderate' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : ''}
                            ${schedule.intensity === 'high' ? 'bg-red-500/10 text-red-600 border-red-500/20' : ''}
                          `}>
                            {schedule.intensity.toUpperCase()} INTENSITY
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 font-medium">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3.5 w-3.5" />
                            {schedule.duration_minutes} min
                          </span>
                        </div>
                        
                        {schedule.notes && (
                          <div className="flex gap-2 items-start text-sm bg-muted/30 p-2.5 rounded-md border text-muted-foreground">
                            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                            <p>{schedule.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
