import { ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  Apple,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  Heart,
  Pill,
  LogOut,
  Menu,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  workspaceAccentPanelClassName,
  workspaceEyebrowClassName,
  workspaceHeaderIconClassName,
  workspaceSecondaryButtonClassName,
  workspaceSelectableClassName,
  workspaceShellBackgroundClassName,
} from "@/components/workspace/workspaceTheme";
import { cn } from "@/lib/utils";

interface PatientShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  patientName?: string;
  onLogout: () => void;
  hideContentHeader?: boolean;
  workspaceMode?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const primaryNavItems: NavItem[] = [
  { to: "/dashboard/patient", label: "Patient Dashboard", icon: Activity, exact: true },
];

const aiNavItems: NavItem[] = [
  { to: "/dashboard/patient/ai/medical", label: "CareSyncAI Medical", icon: MessageSquareHeart },
  { to: "/dashboard/patient/ai/exercise", label: "CareSyncAI Exercise", icon: Dumbbell },
  { to: "/dashboard/patient/ai/diet", label: "CareSyncAI Diet", icon: Apple },
];

const historyNavItems: NavItem[] = [
  { to: "/dashboard/patient/history", label: "All History", icon: Activity, exact: true },
  { to: "/dashboard/patient/history/labs", label: "Lab Reports", icon: FlaskConical },
  { to: "/dashboard/patient/history/medicine", label: "Medicine", icon: Pill },
  { to: "/dashboard/patient/history/gp-visits", label: "GP Visits", icon: Stethoscope },
  { to: "/dashboard/patient/history/specialist", label: "Specialist", icon: UserRound },
];

const calendarNavItems: NavItem[] = [
  { to: "/dashboard/patient/calendar/exercise", label: "Exercise Calendar", icon: CalendarDays },
  { to: "/dashboard/patient/calendar/diet", label: "Diet Calendar", icon: CalendarDays },
];

const navItems = [...primaryNavItems, ...aiNavItems, ...calendarNavItems, ...historyNavItems];

export default function PatientShell({
  children,
  title,
  subtitle,
  patientName,
  onLogout,
  hideContentHeader = false,
  workspaceMode = false,
}: PatientShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const aiRouteActive = location.pathname.startsWith("/dashboard/patient/ai");
  const [aiOpen, setAiOpen] = useState(aiRouteActive);
  const calendarRouteActive = location.pathname.startsWith("/dashboard/patient/calendar");
  const [calendarOpen, setCalendarOpen] = useState(calendarRouteActive);
  const historyRouteActive = location.pathname.startsWith("/dashboard/patient/history");
  const [historyOpen, setHistoryOpen] = useState(historyRouteActive);

  const activeLabel = useMemo(() => {
    const matched = navItems.find((item) =>
      item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to),
    );
    return matched?.label ?? "CareSyncAI";
  }, [location.pathname]);

  useEffect(() => {
    if (aiRouteActive) {
      setAiOpen(true);
    }
  }, [aiRouteActive]);

  useEffect(() => {
    if (calendarRouteActive) {
      setCalendarOpen(true);
    }
  }, [calendarRouteActive]);

  useEffect(() => {
    if (historyRouteActive) {
      setHistoryOpen(true);
    }
  }, [historyRouteActive]);

  const inactiveNavClassName = workspaceSelectableClassName;

  return (
    <div
      className={workspaceShellBackgroundClassName.replace(
        "caresync-workspace-theme",
        "caresync-patient-theme relative",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="theme-glow-blob pointer-events-none absolute left-1/2 top-[16%] h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-[140px]" />
      <div className="theme-glow-blob pointer-events-none absolute bottom-[-5rem] left-[16%] h-72 w-72 rounded-full bg-cyan-400/10 blur-[150px]" />
      <div className="relative">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div
          className={cn(
            "flex h-16 items-center justify-between gap-4",
            workspaceMode ? "w-full px-3 sm:px-4" : "mx-auto max-w-[1720px] px-4 sm:px-6 xl:px-8",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-200 hover:bg-white/10"
              onClick={() => setSidebarOpen((value) => !value)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            {workspaceMode ? (
              <Button
                variant="ghost"
                size="icon"
                className="hidden text-slate-200 hover:bg-white/10 lg:inline-flex"
                onClick={() => setSidebarCollapsed((current) => !current)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            ) : null}
            <div className="flex min-w-0 items-center gap-3">
              <div className={workspaceHeaderIconClassName}>
                <Heart className="h-5 w-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-tight">CareSyncAI</p>
                <p className="truncate text-xs text-slate-400">{activeLabel}</p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-sm font-medium text-slate-100">{patientName ?? "Patient"}</p>
              <p className="truncate text-xs text-slate-400">Secure patient workspace</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex",
          workspaceMode
            ? "h-[calc(100vh-4rem)] max-w-none gap-0 px-0 py-0"
            : "max-w-[1720px] gap-6 px-4 py-6 sm:px-6 xl:px-8",
        )}
      >
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-30 w-72 border-r border-white/10 bg-slate-950/80 px-4 py-5 backdrop-blur-xl transition-all duration-300 lg:static lg:h-[calc(100vh-7rem)] lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:rounded-3xl lg:border lg:bg-slate-900/50",
            workspaceMode &&
              "lg:h-full lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:bg-slate-950/60 lg:py-4",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            sidebarCollapsed ? "lg:w-20 lg:px-3" : "lg:w-72",
          )}
        >
          {!workspaceMode ? (
            <div
              className={cn(
                "mb-4 hidden lg:flex",
                sidebarCollapsed ? "justify-center" : "justify-end",
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn("rounded-xl", workspaceSecondaryButtonClassName)}
                onClick={() => setSidebarCollapsed((current) => !current)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            </div>
          ) : null}

          <nav className="space-y-5">
            <div className="space-y-2">
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={() => setSidebarOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-2xl border px-3 py-3 text-sm transition-colors",
                      sidebarCollapsed ? "justify-center" : "gap-3",
                      isActive
                        ? workspaceAccentPanelClassName
                        : inactiveNavClassName,
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </NavLink>
              ))}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                    setAiOpen(true);
                    return;
                  }
                  setAiOpen((current) => !current);
                }}
                title="CareSyncAI"
                aria-label="CareSyncAI"
                className={cn(
                  "flex w-full items-center rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
                  sidebarCollapsed ? "justify-center" : "justify-between",
                  aiRouteActive || aiOpen
                    ? workspaceAccentPanelClassName
                    : inactiveNavClassName,
                )}
              >
                <span className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
                  <Sparkles className="h-4 w-4" />
                  {!sidebarCollapsed ? <span>CareSyncAI</span> : null}
                </span>
                {!sidebarCollapsed ? (
                  aiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : null}
              </button>

              {aiOpen && !sidebarCollapsed ? (
                <div className="space-y-2 pl-3">
                  {aiNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={() => setSidebarOpen(false)}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                          isActive
                            ? workspaceAccentPanelClassName
                            : inactiveNavClassName,
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                    setCalendarOpen(true);
                    return;
                  }
                  setCalendarOpen((current) => !current);
                }}
                title="CareSync Calendar"
                aria-label="CareSync Calendar"
                className={cn(
                  "flex w-full items-center rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
                  sidebarCollapsed ? "justify-center" : "justify-between",
                  calendarRouteActive || calendarOpen
                    ? workspaceAccentPanelClassName
                    : inactiveNavClassName,
                )}
              >
                <span className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
                  <CalendarDays className="h-4 w-4" />
                  {!sidebarCollapsed ? <span>CareSync Calendar</span> : null}
                </span>
                {!sidebarCollapsed ? (
                  calendarOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : null}
              </button>

              {calendarOpen && !sidebarCollapsed ? (
                <div className="space-y-2 pl-3">
                  {calendarNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={() => setSidebarOpen(false)}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                          isActive
                            ? workspaceAccentPanelClassName
                            : inactiveNavClassName,
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                    setHistoryOpen(true);
                    return;
                  }
                  setHistoryOpen((current) => !current);
                }}
                title="Medical History"
                aria-label="Medical History"
                className={cn(
                  "flex w-full items-center rounded-2xl border px-3 py-3 text-left text-sm transition-colors",
                  sidebarCollapsed ? "justify-center" : "justify-between",
                  historyRouteActive || historyOpen
                    ? workspaceAccentPanelClassName
                    : inactiveNavClassName,
                )}
              >
                <span className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
                  <ShieldCheck className="h-4 w-4" />
                  {!sidebarCollapsed ? <span>Medical History</span> : null}
                </span>
                {!sidebarCollapsed ? (
                  historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                ) : null}
              </button>

              {historyOpen && !sidebarCollapsed ? (
                <div className="space-y-2 pl-3">
                  {historyNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={() => setSidebarOpen(false)}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                          isActive
                            ? workspaceAccentPanelClassName
                            : inactiveNavClassName,
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        {sidebarOpen ? (
          <button
            className="fixed inset-0 top-16 z-20 bg-slate-950/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
        ) : null}

        <main
          className={cn(
            "relative z-10 min-w-0 flex-1",
            workspaceMode ? "h-full overflow-hidden pb-0" : "pb-10",
          )}
        >
          {!hideContentHeader ? (
            <div className="mb-5">
              <p className={workspaceEyebrowClassName}>Patient Workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-400">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
