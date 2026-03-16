import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, Brain, Utensils, Droplets, Info, AlertTriangle, Apple 
} from "lucide-react";
import { generateDietPlan, type DietPlan } from "@/lib/api";
import { useRequiredAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function DietPlanner() {
  const { isAuthenticated, token, user, logout } = useRequiredAuth("patient");
  const { toast } = useToast();
  
  // Form State
  const [targetCalories, setTargetCalories] = useState<number[]>([2000]);
  const [mealsPerDay, setMealsPerDay] = useState("3");
  const [includeSnacks, setIncludeSnacks] = useState(true);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  
  // Data Sharing State
  const [shareMedicalHistory, setShareMedicalHistory] = useState(true);
  const [shareMedications, setShareMedications] = useState(true);
  const [shareHealthMetrics, setShareHealthMetrics] = useState(true);

  // Result State
  const [planResult, setPlanResult] = useState<{ plans: DietPlan[], summary: string } | null>(null);

  const DIET_RESTRICTIONS = [
    "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", 
    "Keto", "Low-Carb", "Halal", "Kosher"
  ];

  const toggleRestriction = (r: string) => {
    setRestrictions((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    );
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not authenticated");
      return generateDietPlan(token, {
        dietary_restrictions: restrictions,
        target_calories: targetCalories[0],
        meals_per_day: parseInt(mealsPerDay, 10),
        include_snacks: includeSnacks,
      });
    },
    onSuccess: (data) => {
      setPlanResult({ plans: data.items, summary: data.ai_summary });
      toast({ title: "Diet plan generated successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  // Calculate totals
  const totalCalories = planResult?.plans.reduce((sum, p) => sum + p.calories, 0) || 0;
  const totalProtein = planResult?.plans.reduce((sum, p) => sum + p.protein_g, 0) || 0;
  const totalCarbs = planResult?.plans.reduce((sum, p) => sum + p.carbs_g, 0) || 0;
  const totalFat = planResult?.plans.reduce((sum, p) => sum + p.fat_g, 0) || 0;

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
            <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg">
              <Apple className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Diet Planner</h1>
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
          <Card className="border-orange-500/10 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Utensils className="h-4 w-4 text-orange-500" />
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
                The AI will use your health profile to avoid allergens and tailor macronutrients for your conditions.
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/10 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dietary Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Target Calories</label>
                  <span className="text-sm font-bold text-orange-500">{targetCalories[0]} kcal</span>
                </div>
                <Slider 
                  value={targetCalories}
                  onValueChange={setTargetCalories}
                  max={4000}
                  min={1200}
                  step={50}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Meals Per Day</label>
                <select 
                  value={mealsPerDay}
                  onChange={(e) => setMealsPerDay(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                >
                  <option value="2">2 Meals</option>
                  <option value="3">3 Meals</option>
                  <option value="4">4 Meals</option>
                  <option value="5">5 Meals (Small)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Include Snacks</label>
                <Switch checked={includeSnacks} onCheckedChange={setIncludeSnacks} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex justify-between">
                  Restrictions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIET_RESTRICTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => toggleRestriction(r)}
                      className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                        restrictions.includes(r) 
                          ? "bg-orange-500 text-white border-orange-500" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? "Generating Menu..." : "Generate Meal Plan"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Results */}
        <div className="space-y-6">
          {/* Loading State */}
          {generateMutation.isPending && (
            <Card className="border-orange-500/20 bg-background/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500/20 animate-ping"></div>
                  <div className="absolute inset-2 rounded-full bg-orange-500 animate-pulse flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <Apple className="h-8 w-8 text-white animate-bounce" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-orange-500 animate-pulse">
                  Cooking up your diet plan...
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Calculating macros and matching ingredients to your {targetCalories[0]} kcal target and medical profile.
                </p>
                <div className="w-full space-y-3 mt-6">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Initial State (Empty) */}
          {!generateMutation.isPending && !planResult && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-orange-500/20 bg-orange-500/5">
              <div className="h-20 w-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6">
                <Apple className="h-10 w-10 text-orange-500/40" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-foreground">Plan your meals smartly</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                CareSync AI analyzes your health conditions and allergies to create a delicious, medically-appropriate meal plan that hits your macronutrient targets.
              </p>
              <Button onClick={() => generateMutation.mutate()} className="bg-orange-500 hover:bg-orange-600 text-white">
                Generate My Menu
              </Button>
            </div>
          )}

          {/* Result State */}
          {!generateMutation.isPending && planResult && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Daily Macro Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="border-orange-500/20 bg-orange-500/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Calories</p>
                    <p className="text-2xl font-black text-orange-500">{totalCalories.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">/ {targetCalories[0]} kcal</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Protein</p>
                    <p className="text-2xl font-black">{totalProtein.toFixed(0)}g</p>
                    <div className="h-1 w-full bg-muted mt-2 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[30%]" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Carbs</p>
                    <p className="text-2xl font-black">{totalCarbs.toFixed(0)}g</p>
                    <div className="h-1 w-full bg-muted mt-2 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 w-[50%]" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Fat</p>
                    <p className="text-2xl font-black">{totalFat.toFixed(0)}g</p>
                    <div className="h-1 w-full bg-muted mt-2 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 w-[20%]" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Summary Header */}
              <Card className="border border-border">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Brain className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Nutritional Rationale</h3>
                      <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed">
                        {planResult.summary.split('\n').map((line, i) => {
                          if (line.includes("💧 Hydration:")) {
                            return (
                              <div key={i} className="flex gap-2 items-start mt-4 mb-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-700 dark:text-blue-400">
                                <Droplets className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                                <p className="m-0 text-sm">{line.replace("💧 Hydration:", "").trim()}</p>
                              </div>
                            );
                          }
                          if (line.includes("⚠️ Important:")) {
                            return (
                              <div key={i} className="flex gap-2 items-start mt-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <p className="m-0 text-sm">{line.replace("⚠️ Important:", "").trim()}</p>
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

              {/* Meal List */}
              <div className="space-y-4">
                {planResult.plans.map((meal, i) => (
                  <Card key={i} className="overflow-hidden shadow-sm hover:shadow-md transition-all border border-border/50">
                    <div className="p-5 flex flex-col md:flex-row gap-5 items-start md:items-center">
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-orange-500/10 text-orange-600">
                            {meal.meal_type}
                          </span>
                        </div>
                        <h4 className="font-bold text-base md:text-lg mb-2 text-foreground leading-tight">
                          {meal.food_items}
                        </h4>
                        
                        {meal.notes && (
                          <div className="flex gap-2 items-start text-xs text-muted-foreground">
                            <Info className="h-3.5 w-3.5 shrink-0 text-orange-400 mt-0.5" />
                            <p>{meal.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Macros Box */}
                      <div className="w-full md:w-auto shrink-0 bg-muted/40 p-3 rounded-lg border flex gap-4 md:gap-6 justify-between">
                        <div className="text-center">
                          <p className="text-xl font-black text-orange-500">{meal.calories.toFixed(0)}</p>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">kcal</p>
                        </div>
                        <div className="w-px bg-border my-1"></div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-foreground">{meal.protein_g.toFixed(0)}g</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Protein</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-foreground">{meal.carbs_g.toFixed(0)}g</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Carbs</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-foreground">{meal.fat_g.toFixed(0)}g</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Fat</p>
                        </div>
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
