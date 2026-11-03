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
  pickMode = false,
  onPick,
  boxMode = false,
  onBox,
}: {
  pins: MapPin[];
  selected: string[];
  numbers: Record<string, number>;
  start: { lat: number; lng: number } | null;
  routeLine: { lat: number; lng: number }[];
  onAdd?: (id: string) => void;
  onOpen: (id: string) => void;
  onVisit: (id: string) => void;
  /** Tapping a pin picks it (no popup). */
  pickMode?: boolean;
  onPick?: (id: string) => void;
  /** Dragging draws a box and picks every pin inside it. */
  boxMode?: boolean;
  onBox?: (ids: string[]) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const callbacks = useRef({ onAdd, onOpen, onVisit });
  callbacks.current = { onAdd, onOpen, onVisit };
  const pickRef = useRef({ onPick, onBox, pins, selected });
  pickRef.current = { onPick, onBox, pins, selected };
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
      if (act === "add") callbacks.current.onAdd?.(id);
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
      const showAdd = Boolean(callbacks.current.onAdd);
      for (const pin of pins) {
        const color = selected.includes(pin.id) ? "#042f2e" : pin.due === "overdue" ? "#e11d48" : pin.due === "due" ? "#f59e0b" : "#0f766e";
        const number = numbers[pin.id];
        if (pickMode) {
          const on = selected.includes(pin.id);
          const pickIcon = L.divIcon({
            className: "",
            html: `<div style="width:24px;height:24px;border-radius:999px;background:${on ? "#042f2e" : color};color:white;border:${on ? "3px solid #fbbf24" : "2px solid white"};box-shadow:0 1px 4px rgba(0,0,0,.35);font:700 12px sans-serif;display:flex;align-items:center;justify-content:center">${on ? "&#10003;" : ""}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          // Not interactive: taps and clicks are read off the map container (see the pick effect below),
          // so a pin redrawn mid-click, or a browser that sends two click events, can't drop or undo a pick.
          L.marker([pin.lat, pin.lng], { icon: pickIcon, title: pin.name, zIndexOffset: on ? 500 : 0, interactive: false, keyboard: false })
            .addTo(layer);
          bounds.push([pin.lat, pin.lng]);
          continue;
        }
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
            `<div style="min-width:180px"><strong>${safeName}</strong><div style="color:#667;font-size:12px;margin:4px 0">${safeAddress}</div><div style="font-size:12px;margin-bottom:8px">${escapeHtml(pin.schedule)}</div>${showAdd ? `<button type="button" data-act="add" data-id="${pin.id}" style="margin-right:6px">Add to route</button>` : ""}<button type="button" data-act="open" data-id="${pin.id}" style="margin-right:6px">Details</button><button type="button" data-act="visit" data-id="${pin.id}">Log visit</button></div>`,
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
  }, [ready, filterKey, selected, numbers, start, routeLine, pins, pickMode]);

  // Click pins: a tap or click that barely moves picks the nearest pin under it; a drag still pans the map.
  useEffect(() => {
    const map = mapRef.current;
    const node = el.current;
    if (!map || !node || !pickMode) return;
    // Quick taps on two pins would otherwise read as a double-tap and zoom the map.
    map.doubleClickZoom.disable();
    let origin: { x: number; y: number; id: number } | null = null;
    const local = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    function down(event: PointerEvent) {
      if ((event.target as HTMLElement | null)?.closest(".leaflet-control, .leaflet-popup")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      origin = event.isPrimary ? { ...local(event), id: event.pointerId } : null;
    }
    function up(event: PointerEvent) {
      if (!origin || event.pointerId !== origin.id) return;
      const at = local(event);
      const from = origin;
      origin = null;
      if (Math.abs(at.x - from.x) > 8 || Math.abs(at.y - from.y) > 8) return;
      const hit = pinAt(map!, pickRef.current.pins, at, pickRef.current.selected);
      if (hit) pickRef.current.onPick?.(hit);
    }
    function cancel() {
      origin = null;
    }
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      map.doubleClickZoom.enable();
    };
  }, [ready, pickMode]);

  const canBox = Boolean(onBox);
  useEffect(() => {
    const map = mapRef.current;
    const node = el.current;
    if (!map || !node || !canBox) return;
    // Shift-drag draws a selection box here, never Leaflet's zoom box.
    map.boxZoom.disable();
    const touchAction = node.style.touchAction;
    if (boxMode) {
      map.dragging.disable();
      node.style.touchAction = "none";
      node.style.cursor = "crosshair";
    }
    let origin: { x: number; y: number } | null = null;
    let box: HTMLDivElement | null = null;
    let pointer = -1;
    let paused = false;
    const local = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    function finish() {
      origin = null;
      pointer = -1;
      box?.remove();
      box = null;
      if (paused) {
        map!.dragging.enable();
        paused = false;
      }
    }
    function down(event: PointerEvent) {
      if (origin) return;
      if ((event.target as HTMLElement | null)?.closest(".leaflet-control")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!boxMode && !(event.pointerType === "mouse" && event.shiftKey)) return;
      // Keep Leaflet from panning or pinch-handling this gesture.
      event.stopPropagation();
      event.preventDefault();
      if (!boxMode && map!.dragging.enabled()) {
        map!.dragging.disable();
        paused = true;
      }
      origin = local(event);
      pointer = event.pointerId;
      box = document.createElement("div");
      box.style.cssText = "position:absolute;z-index:450;border:2px dashed #0f766e;background:rgba(15,118,110,.12);pointer-events:none;border-radius:6px;left:0;top:0;width:0;height:0";
      box.style.left = `${origin.x}px`;
      box.style.top = `${origin.y}px`;
      node!.appendChild(box);
      try { node!.setPointerCapture(event.pointerId); } catch { /* old browsers */ }
    }
    function move(event: PointerEvent) {
      if (!origin || !box || event.pointerId !== pointer) return;
      event.stopPropagation();
      event.preventDefault();
      const at = local(event);
      box.style.left = `${Math.min(origin.x, at.x)}px`;
      box.style.top = `${Math.min(origin.y, at.y)}px`;
      box.style.width = `${Math.abs(at.x - origin.x)}px`;
      box.style.height = `${Math.abs(at.y - origin.y)}px`;
    }
    function up(event: PointerEvent) {
      if (!origin || event.pointerId !== pointer) return;
      event.stopPropagation();
      const at = local(event);
      const from = origin;
      finish();
      if (event.type === "pointercancel") return;
      if (Math.abs(at.x - from.x) < 8 && Math.abs(at.y - from.y) < 8) {
        // A tap in box mode still toggles the pin under it.
        const hit = pinAt(map!, pickRef.current.pins, at, pickRef.current.selected);
        if (hit) pickRef.current.onPick?.(hit);
        return;
      }
      const a = map!.containerPointToLatLng([from.x, from.y]);
      const b = map!.containerPointToLatLng([at.x, at.y]);
      const south = Math.min(a.lat, b.lat), north = Math.max(a.lat, b.lat);
      const west = Math.min(a.lng, b.lng), east = Math.max(a.lng, b.lng);
      const ids = pickRef.current.pins.filter((pin) => pin.lat >= south && pin.lat <= north && pin.lng >= west && pin.lng <= east).map((pin) => pin.id);
      if (ids.length) pickRef.current.onBox?.(ids);
    }
    const opts = { capture: true } as const;
    node.addEventListener("pointerdown", down, opts);
    node.addEventListener("pointermove", move, opts);
    node.addEventListener("pointerup", up, opts);
    node.addEventListener("pointercancel", up, opts);
    return () => {
      node.removeEventListener("pointerdown", down, opts);
      node.removeEventListener("pointermove", move, opts);
      node.removeEventListener("pointerup", up, opts);
      node.removeEventListener("pointercancel", up, opts);
      finish();
      node.style.touchAction = touchAction;
      node.style.cursor = "";
      map.dragging.enable();
      map.boxZoom.enable();
    };
  }, [ready, boxMode, canBox]);

  return <div ref={el} className="h-full w-full" />;
}

/** The pin nearest to a container point, within a finger's width. */
function pinAt(map: LeafletMap, pins: MapPin[], at: { x: number; y: number }, selected: string[] = []) {
  // Picked pins are drawn on top, so on a tie the picked one is the pin under the finger.
  let best: { id: string; d: number } | null = null;
  for (const pin of pins) {
    const point = map.latLngToContainerPoint([pin.lat, pin.lng]);
    const d = Math.hypot(point.x - at.x, point.y - at.y) - (selected.includes(pin.id) ? 1 : 0);
    if (d <= 16 && (!best || d <= best.d)) best = { id: pin.id, d };
  }
  return best?.id ?? null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
