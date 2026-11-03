"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPin {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  due: "overdue" | "due" | "ok";
  schedule: string;
}

export function MapCanvas({
  pins,
  selected,
  numbers,
  start,
  routeLine,
  onAdd,
  onOpen,
  onVisit,
}: {
  pins: MapPin[];
  selected: string[];
  numbers: Record<string, number>;
  start: { lat: number; lng: number } | null;
  routeLine: { lat: number; lng: number }[];
  onAdd: (id: string) => void;
  onOpen: (id: string) => void;
  onVisit: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const callbacks = useRef({ onAdd, onOpen, onVisit });
  callbacks.current = { onAdd, onOpen, onVisit };
  const [ready, setReady] = useState(0);
  const fitted = useRef("");
  const filterKey = pins.map((pin) => pin.id).join("|");

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let dead = false;
    let map: LeafletMap | null = null;
    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (dead || mapRef.current) return;
      map = L.map(node, { zoomControl: false }).setView([39.8, -98.6], 4);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      const mapbox = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapbox) {
        L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapbox}`,
          { maxZoom: 18, attribution: "&copy; Mapbox &copy; OpenStreetMap", tileSize: 256 },
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
      }
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      node.addEventListener("click", onClick, true);
      node.addEventListener("cora-locate", onLocate);
      setReady((value) => value + 1);
    })();
    function onLocate(event: Event) {
      const coords = (event as CustomEvent<GeolocationCoordinates>).detail;
      mapRef.current?.setView([coords.latitude, coords.longitude], 12);
    }
    function onClick(event: Event) {
      const target = (event.target as HTMLElement | null)?.closest("[data-act]") as HTMLElement | null;
      if (!target) return;
      const id = target.getAttribute("data-id");
      const act = target.getAttribute("data-act");
      if (!id || !act) return;
      if (act === "add") callbacks.current.onAdd(id);
      if (act === "open") callbacks.current.onOpen(id);
      if (act === "visit") callbacks.current.onVisit(id);
    }
    return () => {
      dead = true;
      node.removeEventListener("click", onClick, true);
      node.removeEventListener("cora-locate", onLocate);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      layer.clearLayers();
      const bounds: [number, number][] = [];
      if (start) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;background:#c4841d;border:2px solid white;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([start.lat, start.lng], { icon }).bindPopup("Route start").addTo(layer);
        bounds.push([start.lat, start.lng]);
      }
      for (const pin of pins) {
        const color = selected.includes(pin.id) ? "#042f2e" : pin.due === "overdue" ? "#e11d48" : pin.due === "due" ? "#f59e0b" : "#0f766e";
        const number = numbers[pin.id];
        const icon = L.divIcon({
          className: "",
          html: `<div style="min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:${color};color:white;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);font:600 10px sans-serif;display:flex;align-items:center;justify-content:center">${number ?? ""}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const safeName = escapeHtml(pin.name);
        const safeAddress = escapeHtml(pin.address);
        L.marker([pin.lat, pin.lng], { icon })
          .bindPopup(
            `<div style="min-width:180px"><strong>${safeName}</strong><div style="color:#667;font-size:12px;margin:4px 0">${safeAddress}</div><div style="font-size:12px;margin-bottom:8px">${escapeHtml(pin.schedule)}</div><button type="button" data-act="add" data-id="${pin.id}" style="margin-right:6px">Add to route</button><button type="button" data-act="open" data-id="${pin.id}" style="margin-right:6px">Details</button><button type="button" data-act="visit" data-id="${pin.id}">Log visit</button></div>`,
          )
          .addTo(layer);
        bounds.push([pin.lat, pin.lng]);
      }
      if (routeLine.length > 1) {
        L.polyline(routeLine.map((point) => [point.lat, point.lng]), { color: "#0f766e", weight: 4, opacity: 0.85 }).addTo(layer);
      }
      if (bounds.length && fitted.current !== filterKey) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        fitted.current = filterKey;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, filterKey, selected, numbers, start, routeLine, pins]);

  return <div ref={el} className="h-full w-full" />;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
