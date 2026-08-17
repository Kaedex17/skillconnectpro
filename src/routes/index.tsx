import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wrench, Zap, Hammer, Plug, Settings, MapPin, Camera, Upload, Send,
  Home, History, User, Menu, LogOut, Sun, Moon, Plus, Minus, Navigation,
  Briefcase, Map as MapIcon, Bell, Facebook, Mail, ChevronRight, CheckCircle2,
  Wallet, Phone, Loader2, Calendar, Star, Receipt, ShieldCheck, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { jobStore, useJobs, type Job, type JobStatus, type Material } from "@/lib/jobStore";
import { LeafletMap, getCurrentPosition, watchPosition } from "@/components/LeafletMap";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({ component: App });

type Role = "client" | "worker";

function App() {
  const [dark, setDark] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Auth bootstrap: listener first, then initial session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setRole(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch role whenever session changes
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Failed to load profile");
        return;
      }
      const r = (data?.role as Role | undefined) ?? "client";
      setRole(r === "worker" ? "worker" : "client");
    })();
    return () => { cancelled = true; };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  return (
    <div className="min-h-screen w-full bg-background flex justify-center">
      <Toaster position="top-center" />
      <div className="w-full max-w-[440px] min-h-screen bg-background relative overflow-hidden">
        {booting ? (
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !session || !role ? (
          <LoginScreen />
        ) : (
          <RoleGuard
            role={role}
            allow={role}
            onExit={signOut}
          >
            {role === "client" ? (
              <ClientDashboard
                dark={dark}
                onToggleDark={() => setDark((d) => !d)}
                onExit={signOut}
              />
            ) : (
              <WorkerDashboard
                dark={dark}
                onToggleDark={() => setDark((d) => !d)}
                onExit={signOut}
              />
            )}
          </RoleGuard>
        )}
      </div>
    </div>
  );
}

/* ─────────────── ROLE GUARD ─────────────── */

function RoleGuard({
  role,
  allow,
  onExit,
  children,
}: {
  role: Role;
  allow: Role;
  onExit: () => void;
  children: React.ReactNode;
}) {
  if (role !== allow) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="h-16 w-16 rounded-2xl bg-destructive/15 flex items-center justify-center mb-4">
          <LogOut className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-bold mb-1">Access denied</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your account ({role}) cannot access the {allow} dashboard.
        </p>
        <Button onClick={onExit} className="rounded-xl">Sign out</Button>
      </div>
    );
  }
  return <>{children}</>;
}

/* ─────────────── LOGIN ─────────────── */

function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, phone, role },
          },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-12 pb-8 bg-gradient-to-b from-primary/90 via-primary to-primary text-primary-foreground">
      {/* Logo */}
      <div className="flex flex-col items-center mt-4 mb-8">
        <div className="h-20 w-20 rounded-2xl bg-accent flex items-center justify-center shadow-lg mb-4 rotate-3">
          <Wrench className="h-10 w-10 text-accent-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-black tracking-tight">
          SKILL <span className="text-accent">LINK</span> PRO
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] opacity-70 mt-1">
          Trusted Workers · On Demand
        </p>
      </div>

      <Card className="bg-card text-card-foreground p-6 rounded-2xl shadow-2xl border-0 space-y-4">
        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-lg">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "py-2 rounded-md text-xs font-semibold transition",
                mode === m
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground",
              )}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {mode === "signin" ? "Sign in to continue" : "Join Skill Link Pro"}
          </p>
        </div>

        {mode === "signup" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">Full name</Label>
              <Input id="name" placeholder="Juan Dela Cruz" value={fullName}
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold">Phone</Label>
              <Input id="phone" placeholder="+63..." value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pwd" className="text-xs font-semibold">Password</Label>
          <Input id="pwd" type="password" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        </div>

        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["client", "worker"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-semibold border transition",
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border",
                  )}
                >
                  {r === "client" ? "Client" : "Worker"}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={submit} disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-11 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? "Sign In" : "Create Account")}
        </Button>
      </Card>

      <div className="mt-auto pt-8 text-center space-y-3">
        <div className="flex justify-center gap-4 text-primary-foreground/70">
          <Phone className="h-4 w-4" />
          <Mail className="h-4 w-4" />
          <Facebook className="h-4 w-4" />
        </div>
        <p className="text-[10px] opacity-60">Ver 1.1 · © Skill Link Pro</p>
      </div>
    </div>
  );
}

/* ─────────────── CLIENT DASHBOARD ─────────────── */

const CATEGORIES = [
  { v: "electrician", label: "Electrician", Icon: Zap },
  { v: "plumber", label: "Plumber", Icon: Wrench },
  { v: "carpenter", label: "Carpenter", Icon: Hammer },
  { v: "appliance", label: "Appliance Technician", Icon: Plug },
  { v: "general", label: "General Repair", Icon: Settings },
];

function ClientDashboard({
  dark, onToggleDark, onExit,
}: { dark: boolean; onToggleDark: () => void; onExit: () => void }) {
  const [tab, setTab] = useState<"home" | "history" | "profile" | "menu">("home");
  const [address, setAddress] = useState("123 Rizal St, Manila");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsWatching, setGpsWatching] = useState(false);
  const stopWatchRef = useRef<null | (() => void)>(null);

  const enableGps = () => {
    setGpsError(null);
    setGpsWatching(true);
    stopWatchRef.current?.();
    stopWatchRef.current = watchPosition(
      (p) => {
        setGps(p);
        setGpsError(null);
      },
      (msg) => {
        setGpsError(msg);
        setGpsWatching(false);
      },
    );
  };

  useEffect(() => {
    enableGps();
    return () => stopWatchRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [problem, setProblem] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("electrician");
  const [images, setImages] = useState<string[]>([]);
  const [payment, setPayment] = useState<"cash" | "digital">("cash");
  const [bookingMode, setBookingMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [laborCost, setLaborCost] = useState<number>(400);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const jobs = useJobs();
  const activeJob = useMemo(
    () => jobs.find((j) => j.id === activeJobId) ?? null,
    [jobs, activeJobId],
  );
  const status = activeJob?.status ?? null;

  const materialsCost = useMemo(
    () => materials.reduce((s, m) => s + m.qty * m.price, 0),
    [materials],
  );
  const totalCost = laborCost + materialsCost;

  // Notify on status transitions
  const [lastStatus, setLastStatus] = useState<JobStatus | null>(null);
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === lastStatus) return;
    setLastStatus(activeJob.status);
    if (activeJob.status === "Accepted") {
      toast.success(`${activeJob.workerName ?? "A worker"} accepted your request!`);
    } else if (activeJob.status === "Rejected") {
      toast.error("Worker rejected — searching for another…");
    } else if (activeJob.status === "Worker En Route") {
      toast(`${activeJob.workerName ?? "Worker"} is on the way`);
    } else if (activeJob.status === "Completed") {
      toast.success("Job completed — please rate your worker");
      if (!activeJob.rating) setShowRating(true);
    }
  }, [activeJob, lastStatus]);

  const [history] = useState([
    { id: 1, title: "Leaking kitchen sink", category: "Plumber", status: "Completed", price: "₱450" },
    { id: 2, title: "Ceiling fan install", category: "Electrician", status: "Completed", price: "₱600" },
    { id: 3, title: "Door hinge repair", category: "Carpenter", status: "Completed", price: "₱300" },
  ]);

  const addMaterial = () => {
    setMaterials((m) => [...m, { name: "", qty: 1, price: 0 }]);
  };
  const updateMaterial = (i: number, patch: Partial<Material>) => {
    setMaterials((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };
  const removeMaterial = (i: number) => {
    setMaterials((m) => m.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!problem) { toast.error("Describe your issue"); return; }
    if (bookingMode === "scheduled" && !scheduledFor) {
      toast.error("Pick a date and time");
      return;
    }
    if (activeJob && !["Completed", "Rejected"].includes(activeJob.status)) {
      toast.error("You already have an active request");
      return;
    }
    const cat = CATEGORIES.find((c) => c.v === category)?.label ?? category;
    const validMaterials = materials.filter((m) => m.name.trim() && m.qty > 0);
    let clientLoc: { lat: number; lng: number } | null = gps
      ? { lat: gps.lat, lng: gps.lng }
      : null;
    if (!clientLoc) {
      toast.message("Getting your GPS location…");
      clientLoc = await getCurrentPosition();
    }
    if (!clientLoc) {
      toast.warning("Couldn't access GPS — using approximate location");
    }
    const job = jobStore.create({
      client: "Juan D.",
      category: cat,
      title: problem,
      notes,
      address,
      distance: `${(0.5 + Math.random() * 2).toFixed(1)} km`,
      laborCost,
      materials: validMaterials,
      scheduledFor: bookingMode === "scheduled" ? scheduledFor : undefined,
      clientLoc: clientLoc ?? undefined,
    });
    setActiveJobId(job.id);
    setLastStatus("Pending");
    toast.success(
      bookingMode === "scheduled" ? "Appointment scheduled!" : "Request sent! Finding a worker…",
    );
  };

  const addImage = () => {
    const palette = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#ef4444"];
    setImages((p) => [...p, palette[p.length % palette.length]]);
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 bg-background">
      <DashboardHeader
        title="Hi, Client"
        subtitle="What needs fixing today?"
        dark={dark}
        onToggleDark={onToggleDark}
      />

      {tab === "home" && (
        <div className="px-4 space-y-4">
          {/* Location card */}
          <Card className="p-4 rounded-2xl border-0 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Your Location</p>
                  <p className="text-[10px] text-muted-foreground">
                    {gps
                      ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} · ±${Math.round(gps.accuracy)}m`
                      : gpsError
                        ? "Location unavailable"
                        : "Locating…"}
                  </p>
                </div>
              </div>
              <Badge
                variant={gps ? "default" : "secondary"}
                className="text-[10px]">
                {gps ? "GPS Live" : gpsWatching ? "GPS…" : "GPS Off"}
              </Badge>
            </div>
            {gpsError && (
              <div className="mb-2 rounded-lg bg-destructive/10 p-2">
                <p className="text-[10px] text-destructive leading-snug">{gpsError}</p>
                <button
                  onClick={enableGps}
                  className="mt-1 text-[10px] font-bold underline text-destructive">
                  Retry GPS
                </button>
              </div>
            )}
            <Input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Search address…" className="h-9" />
          </Card>

          {/* Service request */}
          <Card className="p-4 rounded-2xl border-0 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">Service Request</h3>

            {/* Booking mode */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Booking type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "immediate", label: "Immediate" },
                  { v: "scheduled", label: "Scheduled" },
                ].map((o) => (
                  <button key={o.v} type="button"
                    onClick={() => setBookingMode(o.v as "immediate" | "scheduled")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1.5",
                      bookingMode === o.v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-border",
                    )}>
                    {o.v === "scheduled" && <Calendar className="h-3.5 w-3.5" />}
                    {o.label}
                  </button>
                ))}
              </div>
              {bookingMode === "scheduled" && (
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="mt-2 h-9"
                />
              )}
            </div>


            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Describe your issue
              </Label>
              <Textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Need a worker who can repair or fix the entrance panel."
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Additional notes
              </Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Burn damage, urgent" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Worker category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(({ v, label, Icon }) => (
                    <SelectItem key={v} value={v}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Upload images for servicing
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {images.map((c, i) => (
                  <div key={i} className="aspect-square rounded-lg border"
                    style={{ background: `linear-gradient(135deg, ${c}, ${c}aa)` }} />
                ))}
                <button onClick={addImage}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition">
                  <Camera className="h-4 w-4" />
                  <span className="text-[9px] mt-0.5">Add</span>
                </button>
                <button onClick={addImage}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition">
                  <Upload className="h-4 w-4" />
                  <span className="text-[9px] mt-0.5">Gallery</span>
                </button>
              </div>
            </div>

            {/* Materials */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Required materials
                </Label>
                <button type="button" onClick={addMaterial}
                  className="text-[11px] font-semibold text-accent flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {materials.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  e.g. wires, pipes, switches, spare parts
                </p>
              )}
              {materials.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_50px_70px_28px] gap-1.5 items-center">
                  <Input
                    placeholder="Material" value={m.name}
                    onChange={(e) => updateMaterial(i, { name: e.target.value })}
                    className="h-8 text-xs" />
                  <Input
                    type="number" min={1} value={m.qty}
                    onChange={(e) => updateMaterial(i, { qty: Number(e.target.value) || 0 })}
                    className="h-8 text-xs" />
                  <Input
                    type="number" min={0} placeholder="₱" value={m.price || ""}
                    onChange={(e) => updateMaterial(i, { price: Number(e.target.value) || 0 })}
                    className="h-8 text-xs" />
                  <button type="button" onClick={() => removeMaterial(i)}
                    className="h-8 w-7 flex items-center justify-center text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Labor cost */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Labor cost (₱)
              </Label>
              <Input type="number" min={0} value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value) || 0)} />
            </div>

            {/* Transparent breakdown */}
            <div className="rounded-xl bg-secondary/50 p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Transparent pricing
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Labor</span>
                <span className="font-semibold">₱{laborCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Materials</span>
                <span className="font-semibold">₱{materialsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-border">
                <span className="font-bold">Total</span>
                <span className="font-black text-accent">₱{totalCost.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-4 rounded-2xl border-0 shadow-sm space-y-3">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Payment method
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "cash", label: "Cash" },
                { v: "digital", label: "Digital" },
              ].map((o) => (
                <button key={o.v} onClick={() => setPayment(o.v as "cash" | "digital")}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-semibold border transition",
                    payment === o.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border",
                  )}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={submit}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-11 rounded-xl">
                <Send className="h-4 w-4" /> Request
              </Button>
              <Button
                variant="outline"
                disabled={!activeJob || activeJob.status !== "Completed" || activeJob.paid}
                onClick={() => setShowReceipt(true)}
                className="h-11 rounded-xl font-bold">
                <Wallet className="h-4 w-4" />
                {activeJob?.paid ? "Paid" : "Pay Now"}
              </Button>
            </div>
          </Card>


          {activeJob && ["Accepted", "Worker En Route", "In Progress"].includes(activeJob.status) && (
            <Card className="rounded-2xl border-0 overflow-hidden shadow-md p-0 h-[260px] relative">
              <LeafletMap
                worker={activeJob.workerLoc}
                client={activeJob.clientLoc}
                progress={activeJob.progress}
                workerLabel={activeJob.workerName ?? "Worker"}
                clientLabel="You"
              />
            </Card>
          )}

          {status && (
            <Card className="p-4 rounded-2xl border-0 bg-primary text-primary-foreground shadow-md">
              <p className="text-[10px] uppercase tracking-widest opacity-70">Job Status</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-lg font-bold">{status}</p>
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              {activeJob?.workerName && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="opacity-80">{activeJob.workerName}</span>
                  {activeJob.workerVerified && (
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent gap-1 h-5 px-1.5 text-[10px]">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
              )}
              {activeJob?.scheduledFor && (
                <p className="text-[10px] opacity-70 mt-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Scheduled for {new Date(activeJob.scheduledFor).toLocaleString()}
                </p>
              )}
              <div className="mt-3 flex gap-1">
                {["Pending", "Accepted", "Worker En Route", "In Progress", "Completed"].map((s, i) => {
                  const idx = ["Pending", "Accepted", "Worker En Route", "In Progress", "Completed"].indexOf(status);
                  return (
                    <div key={s} className={cn("h-1 flex-1 rounded-full",
                      i <= idx ? "bg-accent" : "bg-white/20")} />
                  );
                })}
              </div>
              {activeJob?.status === "Completed" && activeJob.rating && (
                <div className="mt-3 flex items-center gap-1 text-xs">
                  <span className="opacity-80">Your rating:</span>
                  {[1,2,3,4,5].map((n) => (
                    <Star key={n} className={cn("h-3.5 w-3.5",
                      n <= activeJob.rating! ? "fill-accent text-accent" : "text-white/30")} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {activeJob && showRating && (
        <RatingModal
          workerName={activeJob.workerName ?? "Worker"}
          onSubmit={(r) => {
            jobStore.setRating(activeJob.id, r);
            setShowRating(false);
            toast.success("Thanks for your feedback!");
          }}
          onClose={() => setShowRating(false)}
        />
      )}

      {activeJob && showReceipt && (
        <ReceiptModal
          job={activeJob}
          paymentMethod={payment}
          onPay={() => {
            jobStore.setPaid(activeJob.id);
            setShowReceipt(false);
            toast.success("Payment successful — receipt sent");
          }}
          onClose={() => setShowReceipt(false)}
        />
      )}


      {tab === "history" && (
        <div className="px-4 space-y-2">
          <h3 className="text-sm font-bold mb-2">Past Requests</h3>
          {history.map((h) => (
            <Card key={h.id} className="p-3 rounded-xl border-0 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{h.title}</p>
                <p className="text-[11px] text-muted-foreground">{h.category} · {h.status}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-accent">{h.price}</p>
                <ChevronRight className="h-4 w-4 inline text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "profile" && <ProfileTab name="Juan Dela Cruz" role="Client" />}
      {tab === "menu" && <MenuTab />}

      <BottomNav
        items={[
          { id: "home", Icon: Home, label: "Home" },
          { id: "history", Icon: History, label: "History" },
          { id: "profile", Icon: User, label: "Profile" },
          { id: "menu", Icon: Menu, label: "Menu" },
          { id: "exit", Icon: LogOut, label: "Exit" },
        ]}
        active={tab}
        onChange={(id) => id === "exit" ? onExit() : setTab(id as typeof tab)}
      />
    </div>
  );
}

/* ─────────────── WORKER DASHBOARD ─────────────── */

function WorkerDashboard({
  dark, onToggleDark, onExit,
}: { dark: boolean; onToggleDark: () => void; onExit: () => void }) {
  const [tab, setTab] = useState<"jobs" | "map" | "requests" | "menu">("requests");
  const [earnings] = useState(3208);
  const [zoom, setZoom] = useState(1);
  const workerName = "Pedro M.";

  const allJobs = useJobs();
  const pendingRequests = useMemo(
    () => allJobs.filter((j) => j.status === "Pending"),
    [allJobs],
  );
  const myActiveJobs = useMemo(
    () =>
      allJobs.filter(
        (j) =>
          j.workerName === workerName &&
          ["Accepted", "Worker En Route", "In Progress"].includes(j.status),
      ),
    [allJobs],
  );

  const accept = (j: Job) => {
    jobStore.setStatus(j.id, "Accepted", workerName);
    setTimeout(() => jobStore.setStatus(j.id, "Worker En Route"), 1200);
    toast.success(`Accepted ${j.client}'s request`);
    setTab("jobs");
  };
  const reject = (j: Job) => {
    jobStore.setStatus(j.id, "Rejected");
    toast("Request rejected");
  };
  const startJob = (j: Job) => {
    jobStore.setStatus(j.id, "In Progress");
    toast.success("Job started");
  };
  const completeJob = (j: Job) => {
    jobStore.setStatus(j.id, "Completed");
    toast.success("Job completed");
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 bg-background">
      {/* Top bar */}
      <div className="px-4 pt-10 pb-4 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-widest opacity-70">Wallet</p>
              <Badge className="bg-accent text-accent-foreground hover:bg-accent gap-1 h-4 px-1.5 text-[9px]">
                <ShieldCheck className="h-2.5 w-2.5" /> Verified
              </Badge>
            </div>
            <p className="text-2xl font-black">₱{earnings.toLocaleString()}.00</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-accent-foreground hover:bg-accent gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live GPS
            </Badge>
            <button onClick={onToggleDark}
              className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {tab === "map" && (
        <div className="px-4 -mt-2">
          <Card className="rounded-2xl border-0 overflow-hidden shadow-md relative h-[420px] p-0">
            {(() => {
              const live = myActiveJobs[0];
              return (
                <>
                  <LeafletMap
                    worker={live?.workerLoc}
                    client={live?.clientLoc}
                    progress={live?.progress}
                    workerLabel={workerName}
                    clientLabel={live?.client ?? "Client"}
                  />
                  <div className="absolute right-3 top-3 flex flex-col gap-1.5">
                    <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))}
                      className="h-9 w-9 rounded-full bg-card shadow flex items-center justify-center">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
                      className="h-9 w-9 rounded-full bg-card shadow flex items-center justify-center">
                      <Minus className="h-4 w-4" />
                    </button>
                    <button className="h-9 w-9 rounded-full bg-accent text-accent-foreground shadow flex items-center justify-center">
                      <Navigation className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <Card className="p-3 rounded-xl border-0 shadow-lg flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {live ? `${live.client} · ${live.category}` : "No active job"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {live
                            ? `${live.title} · ${live.distance} · ${live.price}`
                            : "Accept a request to start tracking"}
                        </p>
                      </div>
                      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-8">
                        Navigate
                      </Button>
                    </Card>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {tab === "jobs" && (
        <div className="px-4 space-y-2">
          <h3 className="text-sm font-bold mb-2">Current Jobs</h3>
          {myActiveJobs.length === 0 && (
            <Card className="p-6 rounded-2xl border-0 shadow-sm text-center">
              <p className="text-sm text-muted-foreground">No active jobs.</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Accept a request from the Requests tab.
              </p>
            </Card>
          )}
          {myActiveJobs.map((j) => (
            <Card key={j.id} className="p-4 rounded-2xl border-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="bg-accent/15 text-accent hover:bg-accent/15 mb-2">
                    {j.status}
                  </Badge>
                  <p className="text-sm font-bold">{j.client}</p>
                  <p className="text-[11px] text-muted-foreground">{j.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{j.address}</p>
                </div>
                <p className="text-lg font-black text-accent">{j.price}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {j.status !== "In Progress" ? (
                  <>
                    <Button variant="outline" className="rounded-xl"
                      onClick={() => { jobStore.setStatus(j.id, "Rejected"); toast("Cancelled"); }}>
                      Cancel
                    </Button>
                    <Button className="bg-primary rounded-xl" onClick={() => startJob(j)}>
                      Start Job
                    </Button>
                  </>
                ) : (
                  <Button className="col-span-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
                    onClick={() => completeJob(j)}>
                    Mark Completed
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "requests" && (
        <div className="px-4 space-y-2">
          <h3 className="text-sm font-bold mb-2">
            Client Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 bg-accent text-accent-foreground hover:bg-accent">
                {pendingRequests.length} new
              </Badge>
            )}
          </h3>
          {pendingRequests.length === 0 && (
            <Card className="p-6 rounded-2xl border-0 shadow-sm text-center">
              <p className="text-sm text-muted-foreground">No pending requests.</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                New client requests will appear here in real time.
              </p>
            </Card>
          )}
          {pendingRequests.map((r) => (
            <Card key={r.id} className="p-3 rounded-2xl border-0 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{r.client}</p>
                    <p className="text-[11px] text-muted-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {r.category} · {r.distance}
                    </p>
                    {r.scheduledFor && (
                      <p className="text-[10px] text-accent mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(r.scheduledFor).toLocaleString()}
                      </p>
                    )}
                    {r.materials.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Materials: {r.materials.map((m) => m.name).filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-bold text-accent">{r.price}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button variant="outline" size="sm" className="rounded-lg"
                  onClick={() => reject(r)}>Reject</Button>
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg"
                  onClick={() => accept(r)}>Accept</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "menu" && <MenuTab />}

      <BottomNav
        items={[
          { id: "jobs", Icon: Briefcase, label: "Jobs" },
          { id: "map", Icon: MapIcon, label: "Map" },
          { id: "requests", Icon: Bell, label: "Requests" },
          { id: "menu", Icon: Menu, label: "Menu" },
          { id: "exit", Icon: LogOut, label: "Exit" },
        ]}
        active={tab}
        onChange={(id) => id === "exit" ? onExit() : setTab(id as typeof tab)}
      />
    </div>
  );
}

/* ─────────────── SHARED ─────────────── */

function DashboardHeader({
  title, subtitle, dark, onToggleDark,
}: { title: string; subtitle: string; dark: boolean; onToggleDark: () => void }) {
  return (
    <div className="px-4 pt-10 pb-4 flex items-center justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {subtitle}
        </p>
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggleDark}
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
          <User className="h-4 w-4 text-accent-foreground" />
        </div>
      </div>
    </div>
  );
}

function BottomNav({
  items, active, onChange,
}: {
  items: { id: string; Icon: typeof Home; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-card border-t border-border z-50">
      <div className="grid grid-cols-5 px-1">
        {items.map(({ id, Icon, label }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onChange(id)}
              className={cn(
                "py-2.5 flex flex-col items-center gap-0.5 transition",
                isActive ? "text-accent" : "text-muted-foreground",
              )}>
              <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileTab({ name, role }: { name: string; role: string }) {
  return (
    <div className="px-4">
      <Card className="p-5 rounded-2xl border-0 shadow-sm text-center">
        <div className="h-20 w-20 rounded-full bg-accent mx-auto flex items-center justify-center mb-3">
          <User className="h-10 w-10 text-accent-foreground" />
        </div>
        <h3 className="text-base font-bold">{name}</h3>
        <p className="text-xs text-muted-foreground">{role}</p>
        <div className="grid grid-cols-3 gap-2 mt-5 text-center">
          {[["12", "Jobs"], ["4.8", "Rating"], ["98%", "On-time"]].map(([v, l]) => (
            <div key={l} className="p-2 rounded-lg bg-secondary">
              <p className="text-sm font-black">{v}</p>
              <p className="text-[10px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MenuTab() {
  const items = ["Settings", "Notifications", "Payment Methods", "Help & Support", "About"];
  return (
    <div className="px-4 space-y-2">
      {items.map((i) => (
        <Card key={i} className="p-3.5 rounded-xl border-0 shadow-sm flex items-center justify-between">
          <p className="text-sm font-medium">{i}</p>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Card>
      ))}
    </div>
  );
}

/* Schematic map (CSS-only) — renders live worker/client positions */
function MapMock({
  zoom,
  workerLoc,
  clientLoc,
  progress,
  workerLabel = "You",
  clientLabel = "Client",
}: {
  zoom: number;
  workerLoc?: { x: number; y: number };
  clientLoc?: { x: number; y: number };
  progress?: number;
  workerLabel?: string;
  clientLabel?: string;
}) {
  const w = workerLoc ?? { x: 20, y: 75 };
  const c = clientLoc ?? { x: 80, y: 20 };
  return (
    <div
      className="relative w-full h-full bg-[#dde6ef] dark:bg-[#1e2a3a] overflow-hidden"
      style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(#ffffff55 1px, transparent 1px), linear-gradient(90deg, #ffffff55 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute left-0 right-0 top-1/2 h-2 bg-white/80 dark:bg-white/30" />
      <div className="absolute top-0 bottom-0 left-1/3 w-2 bg-white/80 dark:bg-white/30" />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          x1={w.x} y1={w.y} x2={c.x} y2={c.y}
          stroke="oklch(0.72 0.19 50)"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {typeof progress === "number" && (
        <div className="absolute top-3 left-3 right-16 bg-card/90 backdrop-blur rounded-lg px-3 py-1.5 shadow">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Live · {Math.round(progress)}%
          </p>
          <div className="h-1 bg-border rounded-full overflow-hidden mt-1">
            <div className="h-full bg-accent transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="absolute transition-all duration-700 ease-linear"
        style={{ left: `${w.x}%`, top: `${w.y}%` }}>
        <div className="relative -translate-x-1/2 -translate-y-full">
          <div className="h-9 w-9 rounded-full bg-primary border-4 border-white shadow-lg flex items-center justify-center">
            <Navigation className="h-4 w-4 text-primary-foreground" />
          </div>
          <p className="text-[10px] font-bold text-center mt-1 text-primary whitespace-nowrap">
            {workerLabel}
          </p>
        </div>
      </div>
      <div className="absolute" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
        <div className="relative -translate-x-1/2 -translate-y-full">
          <div className="h-9 w-9 rounded-full bg-accent border-4 border-white shadow-lg flex items-center justify-center">
            <MapPin className="h-4 w-4 text-accent-foreground" />
          </div>
          <p className="text-[10px] font-bold text-center mt-1 text-accent whitespace-nowrap">
            {clientLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── RATING MODAL ─────────────── */

function RatingModal({
  workerName,
  onSubmit,
  onClose,
}: {
  workerName: string;
  onSubmit: (rating: number) => void;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-[400px] p-6 rounded-3xl border-0 shadow-2xl relative">
        <button onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
        <div className="text-center mb-4">
          <div className="h-16 w-16 rounded-full bg-accent/15 mx-auto flex items-center justify-center mb-3">
            <Star className="h-8 w-8 text-accent fill-accent" />
          </div>
          <h3 className="text-lg font-bold">Rate your worker</h3>
          <p className="text-sm text-muted-foreground">How was your service from {workerName}?</p>
        </div>
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}>
              <Star className={cn("h-9 w-9 transition",
                n <= (hover || rating) ? "fill-accent text-accent" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        <Button onClick={() => onSubmit(rating)}
          className="w-full h-11 rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground">
          Submit rating
        </Button>
      </Card>
    </div>
  );
}

/* ─────────────── DIGITAL RECEIPT MODAL ─────────────── */

function ReceiptModal({
  job,
  paymentMethod,
  onPay,
  onClose,
}: {
  job: Job;
  paymentMethod: "cash" | "digital";
  onPay: () => void;
  onClose: () => void;
}) {
  const total = job.laborCost + job.materialsCost;
  const receiptNo = `SLP-${job.id.toString().padStart(6, "0")}`;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-[400px] p-6 rounded-3xl border-0 shadow-2xl relative">
        <button onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
        <div className="text-center mb-4">
          <div className="h-14 w-14 rounded-full bg-accent/15 mx-auto flex items-center justify-center mb-2">
            <Receipt className="h-7 w-7 text-accent" />
          </div>
          <h3 className="text-lg font-bold">
            {job.paid ? "Digital Receipt" : "Confirm Payment"}
          </h3>
          <p className="text-[11px] text-muted-foreground">Receipt # {receiptNo}</p>
        </div>

        <div className="rounded-xl border border-border p-3 space-y-2 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Service</span>
            <span className="font-semibold text-right max-w-[60%] truncate">{job.title}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Worker</span>
            <span className="font-semibold flex items-center gap-1">
              {job.workerName ?? "—"}
              {job.workerVerified && <ShieldCheck className="h-3 w-3 text-accent" />}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Category</span>
            <span className="font-semibold">{job.category}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Method</span>
            <span className="font-semibold capitalize">{paymentMethod}</span>
          </div>

          {job.materials.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Materials
              </p>
              {job.materials.map((m, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span>{m.name} × {m.qty}</span>
                  <span>₱{(m.qty * m.price).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Labor</span>
              <span>₱{job.laborCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Materials</span>
              <span>₱{job.materialsCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base pt-1 border-t border-border">
              <span className="font-bold">Total</span>
              <span className="font-black text-accent">₱{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {job.paid ? (
          <div className="flex items-center justify-center gap-2 text-accent font-bold py-3">
            <CheckCircle2 className="h-5 w-5" /> Paid
          </div>
        ) : (
          <Button onClick={onPay}
            className="w-full h-11 rounded-xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground">
            <Wallet className="h-4 w-4" /> Pay ₱{total.toLocaleString()}
          </Button>
        )}
      </Card>
    </div>
  );
}

