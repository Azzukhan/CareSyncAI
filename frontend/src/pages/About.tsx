import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Shield, Users, Heart, Clock, Zap } from "lucide-react";

export default function About() {
  return (
    <div className="container py-12">
      <div className="max-w-4xl mx-auto">
        <Badge className="mb-4">About CareSync</Badge>
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Transforming NHS Healthcare Access</h1>
        <p className="text-lg text-muted-foreground mb-10">
          CareSync is a QR-enabled healthcare record system designed to streamline NHS patient care by connecting
          patients, GPs, specialists, labs, and pharmacies through a single, secure platform.
        </p>

        <div className="space-y-8">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> The NHS Problem Today
              </h2>
              <p className="text-muted-foreground mb-4">
                With over 7.6 million patients on waiting lists and 40% spending more than 4 hours in A&E,
                the NHS faces unprecedented challenges in delivering timely care. Fragmented records, lost referrals,
                and repeated medical histories waste billions in administrative costs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> The CareSync Solution
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { icon: Shield, title: "Secure QR Registration", desc: "One-time NHS registration generates a secure QR code using your NHS number." },
                  { icon: Users, title: "Universal Access", desc: "Scannable by all healthcare providers with patient consent." },
                  { icon: Heart, title: "Complete History", desc: "Instant medical history reduces redundant questions and duplicate tests." },
                  { icon: Zap, title: "Streamlined Referrals", desc: "One-scan referrals to specialists, pharmacists, or labs." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-medium text-sm">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Patient Journey</h2>
              <ol className="space-y-3">
                {[
                  "Register with your NHS number and create a secure CareSync profile.",
                  "Receive your unique QR code that links to your complete medical records.",
                  "Present your QR code at any NHS provider — GP, specialist, lab, or pharmacy.",
                  "Providers scan your code and instantly access your relevant medical history.",
                  "All records automatically sync across all your healthcare providers.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center shrink-0 text-xs text-primary-foreground font-bold">{i + 1}</span>
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
