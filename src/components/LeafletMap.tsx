import { useEffect, useRef, useState } from "react";

export type LatLng = { lat: number; lng: number };

type LMap = any;
type LRef = any;

export function LeafletMap({
  worker,
  client,
  progress,
  workerLabel = "Worker",
  clientLabel = "Client",
}: {
  worker?: LatLng;
  client?: LatLng;
  progress?: number;
  workerLabel?: string;
  clientLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    L: LRef;
    map: LMap;
    workerMarker?: any;
    clientMarker?: any;
    line?: any;
  } | null>(null);
  const [ready, setReady] = useState(false);

  // Init map (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default ?? (await import("leaflet"));
      // @ts-expect-error css side-effect import
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || stateRef.current) return;
      const center = client ?? worker ?? { lat: 14.5995, lng: 120.9842 };
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([center.lat, center.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      stateRef.current = { L, map };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (stateRef.current?.map) {
        stateRef.current.map.remove();
        stateRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when positions change
  useEffect(() => {
    if (!ready || !stateRef.current) return;
    const s = stateRef.current;
    const { L, map } = s;

    const makeIcon = (color: string, label: string) =>
      L.divIcon({
        className: "",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="background:${color};border:3px solid white;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.35);"></div>
            <span style="position:absolute;top:34px;font-size:10px;font-weight:700;background:white;color:#111;padding:1px 6px;border-radius:999px;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap;">${label}</span>
          </div>`,
      });

    if (client) {
      if (!s.clientMarker) {
        s.clientMarker = L.marker([client.lat, client.lng], {
          icon: makeIcon("#f59e0b", clientLabel),
        }).addTo(map);
      } else {
        s.clientMarker.setLatLng([client.lat, client.lng]);
      }
    }
    if (worker) {
      if (!s.workerMarker) {
        s.workerMarker = L.marker([worker.lat, worker.lng], {
          icon: makeIcon("#2563eb", workerLabel),
        }).addTo(map);
      } else {
        s.workerMarker.setLatLng([worker.lat, worker.lng]);
      }
    }
    if (worker && client) {
      const pts: [number, number][] = [
        [worker.lat, worker.lng],
        [client.lat, client.lng],
      ];
      if (!s.line) {
        s.line = L.polyline(pts, {
          color: "#f59e0b",
          weight: 3,
          dashArray: "6 8",
        }).addTo(map);
      } else {
        s.line.setLatLngs(pts);
      }
      map.fitBounds(pts, { padding: [50, 50], maxZoom: 16, animate: true });
    } else if (client) {
      map.setView([client.lat, client.lng], 15, { animate: true });
    } else if (worker) {
      map.setView([worker.lat, worker.lng], 15, { animate: true });
    }
  }, [
    ready,
    worker?.lat,
    worker?.lng,
    client?.lat,
    client?.lng,
    workerLabel,
    clientLabel,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {typeof progress === "number" && (
        <div className="absolute top-3 left-3 right-16 z-[400] bg-card/95 backdrop-blur rounded-lg px-3 py-1.5 shadow-lg pointer-events-none">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Live · {Math.round(progress)}%
          </p>
          <div className="h-1 bg-border rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-accent transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Request the user's real GPS position. Resolves to null on denial/failure. */
export function getCurrentPosition(): Promise<LatLng | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}
