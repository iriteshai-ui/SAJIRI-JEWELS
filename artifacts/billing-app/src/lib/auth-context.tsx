import React, { createContext, useContext, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, type AuthUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: Infinity,
    }
  });

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || true;

  useEffect(() => {
    // Only redirect to login for protected routes
    const isPublicRoute =
      location === "/" ||
      location.startsWith("/catalogue") ||
      location === "/login";

    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
