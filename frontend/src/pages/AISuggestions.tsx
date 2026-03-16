import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Apple, Dumbbell, Heart, Link2 } from "lucide-react";

export default function AISuggestionsPage() {
  return (
    <div className="container py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Your Health Suggestions</span>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">Back to Dashboard</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Dumbbell className="mr-2 h-5 w-5" />
              Exercise Recommendations
            </h3>
            <div className="p-4 bg-muted rounded-lg">
              <p className="mb-2">
                <strong>Based on your medical history:</strong>
              </p>
              <ul className="space-y-2 ml-6 list-disc text-muted-foreground">
                <li>Try low-impact exercises like swimming or cycling to reduce strain on your joints</li>
                <li>Aim for 30 minutes of moderate activity at least 5 days a week</li>
                <li>Include strength training twice a week to improve muscle support around joints</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Apple className="mr-2 h-5 w-5" />
              Diet Chart
            </h3>
            <div className="p-4 bg-muted rounded-lg">
              <p className="mb-2">
                <strong>Recommended:</strong>
              </p>
              <ul className="space-y-2 ml-6 list-disc text-muted-foreground">
                <li>Increase fiber intake through whole grains, fruits, and vegetables</li>
                <li>Limit sodium to help manage blood pressure</li>
                <li>Choose lean proteins like fish, chicken, and legumes</li>
                <li>Maintain consistent carbohydrate intake to help manage blood sugar</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Daily Activity Goals
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Steps: 6,542/10,000</span>
                  <span className="text-sm text-muted-foreground">65%</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Calories: 320/500 burned</span>
                  <span className="text-sm text-muted-foreground">64%</span>
                </div>
                <Progress value={64} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Active Minutes: 45/60</span>
                  <span className="text-sm text-muted-foreground">75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Heart className="mr-2 h-5 w-5" />
              Health Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Blood Pressure</p>
                <p className="text-xl font-medium">128/82 mmHg</p>
                <p className="text-xs text-muted-foreground">Last updated: Today</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Blood Glucose</p>
                <p className="text-xl font-medium">6.2 mmol/L</p>
                <p className="text-xs text-muted-foreground">Last updated: Yesterday</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Heart Rate</p>
                <p className="text-xl font-medium">72 bpm</p>
                <p className="text-xs text-muted-foreground">Last updated: Today</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Weight</p>
                <p className="text-xl font-medium">82 kg</p>
                <p className="text-xs text-muted-foreground">Last updated: 3 days ago</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button className="w-full flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connect Fitness App
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
