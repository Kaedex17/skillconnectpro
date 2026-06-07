import { useEffect, useState } from "react";

export type JobStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Worker En Route"
  | "In Progress"
  | "Completed";

export type GeoPoint = { x: number; y: number }; // 0-100 % on the map canvas

export type Material = { name: string; qty: number; price: number };

export type Job = {
  id: number;
  client: string;
  category: string;
  title: string;
  notes?: string;
  address: string;
  distance: string;
  price: string; // total formatted
  laborCost: number;
  materialsCost: number;
  materials: Material[];
  scheduledFor?: string; // ISO datetime, undefined = immediate
  status: JobStatus;
  createdAt: number;
  workerName?: string;
  workerVerified?: boolean;
  clientLoc: GeoPoint;
  workerLoc?: GeoPoint;
  progress: number;
  rating?: number; // 1-5, set by client after completion
  paid?: boolean;
};

type Listener = () => void;

let jobs: Job[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
      clientLoc:
        input.clientLoc ?? {
          x: 60 + Math.random() * 30,
          y: 15 + Math.random() * 25,
        },
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
        next.workerLoc = {
          x: 10 + Math.random() * 20,
          y: 70 + Math.random() * 20,
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
      const loc = {
        x: lerp(j.workerLoc.x, j.clientLoc.x, 0.18),
        y: lerp(j.workerLoc.y, j.clientLoc.y, 0.18),
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
