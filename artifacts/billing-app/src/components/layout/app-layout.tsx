import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Package,
  History,
  ShoppingCart,
  LogOut,
  Loader2,
  Menu,
  KeyRound,
  Download,
  FolderTree,
  Gem,
  ExternalLink,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const onResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-amber-600 w-8 h-8" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { window.location.href = "/login"; },
    });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Product Importer", href: "/importer", icon: Download },
    { label: "Jewellery Products", href: "/products", icon: Gem },
    { label: "Categories", href: "/categories", icon: FolderTree },
    { label: "Orders & Billing", href: "/orders", icon: ShoppingCart },
    { label: "Inventory Log", href: "/inventory", icon: History },
    ...(user.role === "admin" ? [{ label: "Staff Management", href: "/users", icon: Users }] : []),
    { label: "Change Password", href: "/settings", icon: KeyRound },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* ── Top Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shrink-0 z-30 sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-secondary transition-all shrink-0 cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 font-serif font-bold text-lg select-none">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Gem className="w-5 h-5" />
            </div>
            <span className="font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Rits Jewellers
            </span>
            <span className="hidden sm:inline-block text-[11px] font-sans font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/40">
              Management Portal
            </span>
          </div>
        </div>

        {/* View Customer Catalogue Link */}
        <div className="flex items-center gap-3">
          <a
            href="/catalogue"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100/70 border border-amber-200 dark:border-amber-900/60 px-3 py-1.5 rounded-full transition-all shadow-xs"
          >
            <span>Live Customer Catalogue</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* ── Body Row ── */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-[56px] z-20 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{ width: sidebarOpen ? 256 : 0 }}
          className="relative z-30 flex-shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full overflow-hidden transition-[width] duration-300 ease-in-out"
        >
          <div className="w-64 flex flex-col h-full justify-between">
            <nav className="flex-1 py-5 flex flex-col gap-1.5 overflow-y-auto px-4">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { if (window.innerWidth < 768) closeSidebar(); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-xs font-medium whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-sm shadow-amber-600/30 scale-[1.01]"
                        : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Profile & Logout */}
            <div className="p-4 border-t border-sidebar-border/60 bg-black/20 m-3 rounded-xl">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-semibold truncate leading-tight">{user.name}</span>
                  <span className="text-[10px] text-sidebar-foreground/60 truncate capitalize mt-0.5 font-mono">
                    {user.role}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full text-xs text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 justify-start h-8 px-2"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
