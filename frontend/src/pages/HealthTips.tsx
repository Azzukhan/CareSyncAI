import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getHealthTips } from "@/lib/api";

export default function HealthTips() {
  const { data: healthTips = [], isLoading } = useQuery({
    queryKey: ["health-tips"],
    queryFn: getHealthTips,
  });

  return (
    <div className="container py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Health Tips & Resources</h1>
        <p className="text-muted-foreground mb-10">
          NHS-approved guidance to help you stay healthy and informed.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="h-10 w-10 rounded bg-muted animate-pulse" />
                    <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-12 w-full rounded bg-muted animate-pulse" />
                  </CardContent>
                </Card>
              ))
            : healthTips.map((tip) => (
                <Card key={tip.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="pt-6">
                    <div className="text-4xl mb-4">{tip.image}</div>
                    <Badge variant="secondary" className="mb-3">{tip.category}</Badge>
                    <h2 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                      {tip.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-3">{tip.excerpt}</p>
                    <span className="text-xs text-muted-foreground">{tip.read_time} read</span>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  );
}
