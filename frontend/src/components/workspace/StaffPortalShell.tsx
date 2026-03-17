import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heart, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  workspaceCardClassName,
  workspaceHeaderIconClassName,
  workspaceInputClassName,
  workspaceMutedCardClassName,
  workspacePrimaryButtonClassName,
  workspaceSecondaryButtonClassName,
  workspaceShellBackgroundClassName,
  workspaceTabListClassName,
  workspaceTabTriggerClassName,
  workspaceTextareaClassName,
} from "@/components/workspace/workspaceTheme";

interface StaffPortalShellProps {
  children: ReactNode;
  portalLabel: string;
  userName?: string;
  onLogout: () => void;
}

export const staffCardClassName = workspaceCardClassName;
export const staffMutedCardClassName = workspaceMutedCardClassName;
export const staffInputClassName = workspaceInputClassName;
export const staffTextareaClassName = workspaceTextareaClassName;
export const staffPrimaryButtonClassName = workspacePrimaryButtonClassName;
export const staffSecondaryButtonClassName = workspaceSecondaryButtonClassName;
export const staffTabListClassName = workspaceTabListClassName;
export const staffTabTriggerClassName = workspaceTabTriggerClassName;

export default function StaffPortalShell({
  children,
  portalLabel,
  userName,
  onLogout,
}: StaffPortalShellProps) {
  return (
    <div className={`${workspaceShellBackgroundClassName} relative`}>
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
        <div className="mx-auto flex h-16 max-w-[1720px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className={workspaceHeaderIconClassName}>
              <Heart className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight text-slate-100">CareSyncAI</p>
              <p className="truncate text-xs text-slate-400">{portalLabel}</p>
            </div>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-slate-100">{userName ?? "Workspace user"}</p>
              <p className="truncate text-xs text-slate-400">Secure clinical workspace</p>
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

      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
