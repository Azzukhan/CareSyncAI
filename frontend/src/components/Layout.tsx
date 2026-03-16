import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isLanding = location.pathname === "/";
  const isDashboard = location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/gp") ||
    location.pathname.startsWith("/specialist") ||
    location.pathname.startsWith("/lab") ||
    location.pathname.startsWith("/pharmacy");

  if (isDashboard) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Care<span className="text-gradient">Sync</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/health-tips" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Health Tips</Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Log In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="gradient-primary border-0">Sign Up</Button>
            </Link>
          </nav>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t bg-card p-4 space-y-2">
            <Link to="/" className="block px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link to="/about" className="block px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>About</Link>
            <Link to="/health-tips" className="block px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Health Tips</Link>
            <Link to="/login" className="block px-3 py-2 rounded-md text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>Log In</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)}>
              <Button className="w-full gradient-primary border-0 mt-2">Sign Up</Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-card py-12">
        <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Heart className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>CareSync</span>
            </div>
            <p className="text-sm text-muted-foreground">
              QR-enabled healthcare record system transforming NHS access and efficiency.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">How it Works</Link></li>
              <li><Link to="/health-tips" className="hover:text-foreground transition-colors">Health Tips</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">For Providers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/login" className="hover:text-foreground transition-colors">GP Portal</Link></li>
              <li><Link to="/login" className="hover:text-foreground transition-colors">Specialist Portal</Link></li>
              <li><Link to="/login" className="hover:text-foreground transition-colors">Lab Portal</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">NHS Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="container mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © 2026 CareSync. NHS-compliant healthcare access platform.
        </div>
      </footer>
    </div>
  );
}
