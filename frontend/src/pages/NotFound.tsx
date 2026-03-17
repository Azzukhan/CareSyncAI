import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="caresync-workspace-theme dark flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#0a1019_0%,#0c1624_50%,#08111f_100%)] px-4 text-slate-100">
      <div className="w-full max-w-3xl rounded-[34px] border border-white/10 bg-slate-950/60 p-8 text-center shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-12">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">404</p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-slate-50 sm:text-6xl">
          Page not found
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-400">
          The route <span className="text-slate-200">{location.pathname}</span> does not exist in
          this CareSync workspace.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button className="h-12 rounded-2xl border-0 bg-[#d3b14d] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950 hover:bg-[#dfc165]">
              Return home
            </Button>
          </Link>
          <Link to="/login">
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-white/10 bg-white/[0.03] px-6 text-sm font-semibold uppercase tracking-[0.24em] text-slate-100 hover:bg-white/[0.06]"
            >
              Open login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
