import { useEffect, useState } from "react";

export type JobStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Worker En Route"
  | "In Progress"
  | "Completed";

export type GeoPoint = { lat: number; lng: number };

export type Material = { name: string; qty: number; price: number };

export type Job = {
  id: number;
  client: string;
  category: string;
  title: string;
  notes?: string;
  address: string;
  distance: string;
  price: string;
  laborCost: number;
  materialsCost: number;
  materials: Material[];
  scheduledFor?: string;
  status: JobStatus;
  createdAt: number;
  workerName?: string;
  workerVerified?: boolean;
  clientLoc: GeoPoint;
  workerLoc?: GeoPoint;
  progress: number;
  rating?: number;
  paid?: boolean;
};

type Listener = () => void;

let jobs: Job[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Default fallback location (Manila) when geolocation is unavailable
const DEFAULT_CENTER: GeoPoint = { lat: 14.5995, lng: 120.9842 };

type CreateInput = {
  client: string;
  category: string;
  title: string;
  notes?: string;
  address: string;
  distance: string;
  laborCost: number;
  materials: Material[];
  scheduledFor?: string;
  clientLoc?: GeoPoint;
};

export const jobStore = {
  getAll(): Job[] {
    return jobs;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  create(input: CreateInput): Job {
    const materialsCost = input.materials.reduce(
      (s, m) => s + m.qty * m.price,
      0,
    );
    const total = input.laborCost + materialsCost;
    const clientLoc: GeoPoint =
      input.clientLoc ?? {
        lat: DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.01,
        lng: DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.01,
      };
    const job: Job = {
      id: nextId++,
      client: input.client,
      category: input.category,
      title: input.title,
      notes: input.notes,
      address: input.address,
      distance: input.distance,
      laborCost: input.laborCost,
      materialsCost,
      materials: input.materials,
      scheduledFor: input.scheduledFor,
      price: `₱${total.toLocaleString()}`,
      status: "Pending",
      createdAt: Date.now(),
      progress: 0,
      clientLoc,
    };
    jobs = [job, ...jobs];
    emit();
    return job;
  },
  setStatus(id: number, status: JobStatus, workerName?: string) {
    jobs = jobs.map((j) => {
      if (j.id !== id) return j;
      const next: Job = {
        ...j,
        status,
        workerName: workerName ?? j.workerName,
        workerVerified: workerName ? true : j.workerVerified,
      };
      if (status === "Accepted" && !next.workerLoc) {
        // Spawn worker ~1.5km away (roughly 0.013° lat/lng)
        const angle = Math.random() * Math.PI * 2;
        next.workerLoc = {
          lat: j.clientLoc.lat + Math.cos(angle) * 0.013,
          lng: j.clientLoc.lng + Math.sin(angle) * 0.013,
        };
        next.progress = 0;
      }
      if (status === "In Progress" || status === "Completed") {
        next.workerLoc = { ...next.clientLoc };
        next.progress = 100;
      }
      return next;
    });
    emit();
  },
  updateWorkerLoc(id: number, loc: GeoPoint, progress: number) {
    jobs = jobs.map((j) =>
      j.id === id ? { ...j, workerLoc: loc, progress } : j,
    );
    emit();
  },
  setRating(id: number, rating: number) {
    jobs = jobs.map((j) => (j.id === id ? { ...j, rating } : j));
    emit();
  },
  setPaid(id: number) {
    jobs = jobs.map((j) => (j.id === id ? { ...j, paid: true } : j));
    emit();
  },
  remove(id: number) {
    jobs = jobs.filter((j) => j.id !== id);
    emit();
  },
};

let tickStarted = false;
function startTick() {
  if (tickStarted || typeof window === "undefined") return;
  tickStarted = true;
  setInterval(() => {
    let changed = false;
    jobs = jobs.map((j) => {
      if (j.status !== "Worker En Route" || !j.workerLoc) return j;
      const nextProgress = Math.min(100, j.progress + 4);
      const loc: GeoPoint = {
        lat: lerp(j.workerLoc.lat, j.clientLoc.lat, 0.18),
        lng: lerp(j.workerLoc.lng, j.clientLoc.lng, 0.18),
      };
      changed = true;
      const updated: Job = { ...j, workerLoc: loc, progress: nextProgress };
      if (nextProgress >= 100) {
        updated.status = "In Progress";
        updated.workerLoc = { ...j.clientLoc };
      }
      return updated;
    });
    if (changed) emit();
  }, 1500);
}

export function useJobs(): Job[] {
  const [snap, setSnap] = useState<Job[]>(jobStore.getAll());
  useEffect(() => {
    startTick();
    const unsub = jobStore.subscribe(() => setSnap([...jobStore.getAll()]));
    return () => {
      unsub();
    };
  }, []);
  return snap;
}
