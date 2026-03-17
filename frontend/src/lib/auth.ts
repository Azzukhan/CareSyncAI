import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthSession,
  getStoredAccessToken,
  getStoredUser,
  type AuthUser,
  type UserRole,
} from "@/lib/api";

interface RequiredAuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  logout: () => void;
}

export function useRequiredAuth(requiredRole: UserRole): RequiredAuthState {
  const navigate = useNavigate();
  const token = getStoredAccessToken();
  const user = getStoredUser();
  const isAuthenticated = Boolean(token && user && user.role === requiredRole);

  useEffect(() => {
    if (!token || !user || user.role !== requiredRole) {
      clearAuthSession();
      navigate("/login", { replace: true });
    }
  }, [navigate, requiredRole, token, user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthSession();
      navigate("/login", { replace: true });
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate]);

  return {
    isAuthenticated,
    token,
    user,
    logout: () => {
      clearAuthSession();
      navigate("/login", { replace: true });
    },
  };
}
