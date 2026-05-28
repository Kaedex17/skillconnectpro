import { useEffect, useState } from "react";

export type JobStatus =
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "Worker En Route"
  | "In Progress"
  | "Completed";

export type Job = {
  id: number;
  client: string;
  category: string;
  title: string;
  notes?: string;
  address: string;
  distance: string;
  price: string;
  status: JobStatus;
  createdAt: number;
  workerName?: string;
};

type Listener = () => void;

let jobs: Job[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());

export const jobStore = {
  getAll(): Job[] {
    return jobs;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  create(input: Omit<Job, "id" | "status" | "createdAt">): Job {
    const job: Job = {
      ...input,
      id: nextId++,
      status: "Pending",
      createdAt: Date.now(),
    };
    jobs = [job, ...jobs];
    emit();
    return job;
  },
  setStatus(id: number, status: JobStatus, workerName?: string) {
    jobs = jobs.map((j) =>
      j.id === id ? { ...j, status, workerName: workerName ?? j.workerName } : j,
    );
    emit();
  },
  remove(id: number) {
    jobs = jobs.filter((j) => j.id !== id);
    emit();
  },
};

export function useJobs(): Job[] {
  const [snap, setSnap] = useState<Job[]>(jobStore.getAll());
  useEffect(() => jobStore.subscribe(() => setSnap([...jobStore.getAll()])), []);
  return snap;
}
