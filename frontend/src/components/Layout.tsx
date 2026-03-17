import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isDashboard = location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/gp") ||
    location.pathname.startsWith("/specialist") ||
    location.pathname.startsWith("/lab") ||
    location.pathname.startsWith("/pharmacy");
  const isStandaloneAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  if (isDashboard || isStandaloneAuthPage) return <>{children}</>;

  return (
    <div className="caresync-workspace-theme dark flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#0a1019_0%,#0c1624_50%,#08111f_100%)] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
              <Heart className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="block text-xl font-bold tracking-tight text-slate-100" style={{ fontFamily: "Plus Jakarta Sans" }}>
                CareSync
              </span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-500">
                Unified clinical access
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Home</Link>
            <Link to="/about" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">About</Link>
            <Link to="/health-tips" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Health Tips</Link>
            <Link to="/login">
              <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">Log In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="border-0 bg-[#d3b14d] text-slate-950 shadow-[0_12px_32px_rgba(211,177,77,0.22)] hover:bg-[#dfc165]">Sign Up</Button>
            </Link>
          </nav>

          <Button variant="ghost" size="icon" className="text-slate-200 hover:bg-white/10 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="space-y-2 border-t border-white/10 bg-slate-950/95 p-4 md:hidden">
            <Link to="/" className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link to="/about" className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]" onClick={() => setMobileOpen(false)}>About</Link>
            <Link to="/health-tips" className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]" onClick={() => setMobileOpen(false)}>Health Tips</Link>
            <Link to="/login" className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]" onClick={() => setMobileOpen(false)}>Log In</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)}>
              <Button className="mt-2 w-full border-0 bg-[#d3b14d] text-slate-950 hover:bg-[#dfc165]">Sign Up</Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 bg-slate-950/60 py-12">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                <Heart className="h-4 w-4 text-amber-300" />
              </div>
              <span className="font-bold text-slate-100" style={{ fontFamily: "Plus Jakarta Sans" }}>CareSync</span>
            </div>
            <p className="text-sm text-slate-400">
              Secure NHS-linked access for patients, GPs, specialists, labs, and pharmacies.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-100">Platform</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/about" className="transition-colors hover:text-white">How it Works</Link></li>
              <li><Link to="/health-tips" className="transition-colors hover:text-white">Health Tips</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-100">For Providers</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/login" className="transition-colors hover:text-white">GP Portal</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-white">Specialist Portal</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-white">Lab Portal</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-100">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#" className="transition-colors hover:text-white">Privacy Policy</a></li>
              <li><a href="#" className="transition-colors hover:text-white">Terms of Service</a></li>
              <li><a href="#" className="transition-colors hover:text-white">NHS Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="container mt-8 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
          © 2026 CareSync. NHS-compliant healthcare access platform.
        </div>
      </footer>
    </div>
  );
}
