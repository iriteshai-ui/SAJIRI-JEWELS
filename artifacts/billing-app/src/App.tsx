import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Inventory from "@/pages/inventory";
import Orders from "@/pages/orders";
import NewOrder from "@/pages/orders/new";
import OrderDetail from "@/pages/orders/detail";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import ImporterStudio from "@/pages/importer";
import CategoriesPage from "@/pages/categories";
import CatalogueAccuracyPage from "@/pages/catalogue-accuracy";
import Catalogue from "@/pages/catalogue";
import CatalogueDetail from "@/pages/catalogue/detail";

const queryClient = new QueryClient();

function ProtectedRoute({
  component: Component,
  adminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
}) {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-amber-600 w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-serif font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            You do not have administrative permissions to view this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* ── Public Customer Catalogue Routes ── */}
      <Route path="/" component={Catalogue} />
      <Route path="/catalogue" component={Catalogue} />
      <Route path="/catalogue/:id" component={CatalogueDetail} />

      {/* ── Staff & Admin Authentication ── */}
      <Route path="/login" component={Login} />

      {/* ── Protected Management Portal Routes ── */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/importer"><ProtectedRoute component={ImporterStudio} adminOnly /></Route>
      <Route path="/catalogue-accuracy"><ProtectedRoute component={CatalogueAccuracyPage} adminOnly /></Route>
      <Route path="/categories"><ProtectedRoute component={CategoriesPage} adminOnly /></Route>
      <Route path="/products"><ProtectedRoute component={Products} adminOnly /></Route>
      <Route path="/inventory"><ProtectedRoute component={Inventory} adminOnly /></Route>
      <Route path="/orders/new"><ProtectedRoute component={NewOrder} /></Route>
      <Route path="/orders/:id"><ProtectedRoute component={OrderDetail} /></Route>
      <Route path="/orders"><ProtectedRoute component={Orders} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} adminOnly /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
