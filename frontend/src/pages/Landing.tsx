import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  QrCode, Shield, Clock, Users, ArrowRight, Heart,
  Stethoscope, FlaskConical, Pill, UserCheck, ChevronRight,
  Zap, Lock, BarChart3
} from "lucide-react";
import { getHealthTips } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Landing() {
  const { data: healthTips = [], isLoading } = useQuery({
    queryKey: ["health-tips"],
    queryFn: getHealthTips,
  });

  return (
    <div>
      <section className="relative overflow-hidden gradient-hero py-24 md:py-32">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-white/20 text-white border-white/30 hover:bg-white/30">
                NHS-Compliant Healthcare Platform
              </Badge>
              <h1
                className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                Where Your NHS History Meets <span className="text-accent">Smart Access</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
                A QR-enabled healthcare record system transforming NHS access and efficiency.
                One scan connects patients, GPs, specialists, labs, and pharmacies.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold gap-2 w-full sm:w-auto">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/about">
                  <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 w-full sm:w-auto">
                    How It Works
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 border-b">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "7.6M+", label: "Patients waiting for NHS care" },
              { value: "40%", label: "Spend 4+ hrs in A&E" },
              { value: "£12B", label: "Lost to admin inefficiency" },
              { value: "1 Scan", label: "To access full history" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <p className="text-3xl md:text-4xl font-extrabold text-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why CareSync?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Addressing the core challenges facing the NHS today with smart, secure technology.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Clock, title: "Reduces Waiting", desc: "Streamlined referrals and faster appointments through instant record sharing." },
              { icon: Zap, title: "Frictionless Coordination", desc: "Seamless communication between all healthcare providers via centralised records." },
              { icon: Lock, title: "NHS-Compliant Security", desc: "Patient-controlled data access with granular privacy settings." },
              { icon: BarChart3, title: "Cost Reduction", desc: "Fewer duplicate tests and reduced administrative overhead." },
            ].map((item, index) => (
              <motion.div
                key={index}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-border/50">
                  <CardContent className="pt-6">
                    <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                      <item.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Your patient journey in 5 simple steps.</p>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { step: "1", icon: UserCheck, title: "Register", desc: "Create account with NHS number and receive your unique QR code." },
              { step: "2", icon: QrCode, title: "Present QR", desc: "Show your QR code to any healthcare provider." },
              { step: "3", icon: Stethoscope, title: "Get Care", desc: "Doctor scans and instantly accesses your full history." },
              { step: "4", icon: FlaskConical, title: "Refer", desc: "One-scan referrals to specialists, labs, or pharmacies." },
              { step: "5", icon: Heart, title: "Sync", desc: "All records update automatically across all providers." },
            ].map((item, index) => (
              <motion.div
                key={index}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="h-14 w-14 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-3">
                  <item.icon className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="text-xs font-bold text-accent mb-1">STEP {item.step}</div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Five Portals, One System</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Purpose-built dashboards for every role in the NHS care journey.
            </p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: Users, title: "Patient", desc: "View records, manage privacy, upload health data", color: "gradient-primary" },
              { icon: Stethoscope, title: "GP", desc: "See patients, prescribe, refer to specialists", color: "gradient-accent" },
              { icon: Shield, title: "Specialist", desc: "View GP notes, order labs, prescribe", color: "gradient-primary" },
              { icon: FlaskConical, title: "Lab", desc: "View test orders, upload results", color: "gradient-accent" },
              { icon: Pill, title: "Pharmacy", desc: "View prescriptions, dispense medicines", color: "gradient-primary" },
            ].map((item, index) => (
              <motion.div
                key={index}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="text-center h-full hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className={`h-12 w-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-3`}>
                      <item.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">Health Tips & Resources</h2>
              <p className="text-muted-foreground">Stay informed with the latest NHS health guidance.</p>
            </div>
            <Link to="/health-tips">
              <Button variant="outline" className="hidden md:flex gap-2">
                View All <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="h-full">
                    <CardContent className="pt-6 space-y-4">
                      <div className="h-10 w-10 rounded bg-muted animate-pulse" />
                      <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-12 w-full rounded bg-muted animate-pulse" />
                    </CardContent>
                  </Card>
                ))
              : healthTips.slice(0, 3).map((tip, index) => (
                  <motion.div
                    key={tip.id}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                  >
                    <Card className="h-full hover:shadow-lg transition-all cursor-pointer group">
                      <CardContent className="pt-6">
                        <div className="text-4xl mb-4">{tip.image}</div>
                        <Badge variant="secondary" className="mb-3">{tip.category}</Badge>
                        <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                          {tip.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">{tip.excerpt}</p>
                        <span className="text-xs text-muted-foreground">{tip.read_time} read</span>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
          </div>
          <div className="mt-6 text-center md:hidden">
            <Link to="/health-tips">
              <Button variant="outline" className="gap-2">
                View All <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="gradient-hero rounded-3xl p-10 md:p-16 text-center text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 right-10 w-64 h-64 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your NHS Experience?</h2>
              <p className="text-white/80 mb-8 max-w-xl mx-auto">
                Register today and receive your unique CareSync QR code. One-time setup, lifetime connected care.
              </p>
              <Link to="/signup">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold gap-2">
                  Register Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
