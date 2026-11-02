import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Gem, Loader2, KeyRound, Sparkles, AlertCircle, Eye, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const login = useLogin();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    login.mutate(
      { data: { username, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          const msg =
            err.response?.data?.error ||
            err.response?.data?.message ||
            (typeof err.message === "string" && !err.message.includes("status code")
              ? err.message
              : null) ||
            "Invalid username or password. Please try again.";
          setErrorMsg(msg);
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: msg,
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] dark:bg-neutral-950 font-sans overflow-hidden">
      {/* ── Left Pane: Luxury Editorial Branding (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-[#141517] text-white p-16 relative overflow-hidden border-r border-amber-950/40 select-none">
        {/* Glow effect blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-700/10 blur-[110px] pointer-events-none" />

        {/* Logo/Brand Header */}
        <div className="flex items-center justify-between z-10">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="SAJIRI JEWELS"
              className="w-10 h-10 rounded-full shadow-gold-sm"
            />
            <div>
              <span className="font-serif font-bold text-xl tracking-wider text-amber-50">
                SAJIRI JEWELS
              </span>
              <p className="text-[10px] text-amber-200/60 uppercase tracking-widest">
                Store Management
              </p>
            </div>
          </Link>

          <Link
            href="/catalogue"
            className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-xs transition-colors"
          >
            <span>Customer Catalogue</span>
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Hero Content */}
        <div className="space-y-6 z-10 max-w-lg my-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Haute Fashion Jewellery Platform</span>
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-amber-50">
            Purity. Craftsmanship. <br />
            Seamless Control.
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed font-light">
            Import and organize curated anti-tarnish fashion jewellery, monitor stock
            levels across collections, maintain live product catalogues, and execute
            orders effortlessly.
          </p>
        </div>

        {/* Footer/System Status */}
        <div className="flex items-center justify-between text-xs text-neutral-500 z-10 border-t border-neutral-800/80 pt-6">
          <span>&copy; {new Date().getFullYear()} SAJIRI JEWELS. All rights reserved.</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Supabase Cloud Connected
          </span>
        </div>
      </div>

      {/* ── Right Pane: Elegant Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#FAF9F6] dark:bg-neutral-900 relative">
        <div className="w-full max-w-md">
          {/* Back to Catalogue */}
          <div className="mb-6 flex justify-between items-center">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-amber-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Browse Customer Catalogue
            </Link>
          </div>

          <Card className="border border-amber-200/60 dark:border-neutral-800 shadow-xl rounded-2xl bg-white dark:bg-neutral-950 overflow-hidden">
            <CardHeader className="space-y-2 pb-6 text-center">
              <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center mb-2 shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <CardTitle className="font-serif text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Staff Authentication
              </CardTitle>
              <CardDescription className="text-neutral-500 text-xs">
                Sign in to access your inventory and management studio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Username
                  </Label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-300 focus-visible:ring-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Password
                  </Label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border-neutral-300 focus-visible:ring-amber-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={login.isPending}
                  className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shadow-sm shadow-amber-600/30 transition-all mt-2"
                >
                  {login.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    "Sign In to Dashboard"
                  )}
                </Button>
              </form>

              {/* Default Credentials Hint */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 text-center">
                <p className="text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                  Default Store Admin: <span className="font-mono font-bold">admin</span> /{" "}
                  <span className="font-mono font-bold">Sajiri@123</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
