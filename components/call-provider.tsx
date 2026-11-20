"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CALL_OUTCOMES, dialNumber, formatDuration, suggestOutcome } from "@/lib/voice-shared";
import { getCallStatusAction, saveCallOutcomeAction } from "@/lib/voice-actions";

type Phase = "idle" | "connecting" | "ringing" | "connected" | "ended" | "incoming";
type VoiceCall = {
  parameters: Record<string, string>;
  accept: () => void; reject: () => void; disconnect: () => void; mute: (m: boolean) => void; sendDigits: (d: string) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};
type VoiceDevice = {
  register: () => Promise<void>; connect: (o: { params: Record<string, string> }) => Promise<VoiceCall>; updateToken: (t: string) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void; destroy: () => void;
};

type Ctx = {
  /** True when this person can use browser calling. */
  enabled: boolean;
  startCall: (input: { number: string; name?: string }) => void;
  /** Bumps each time a call is saved, so call lists can reload. */
  version: number;
};
const CallContext = createContext<Ctx>({ enabled: false, startCall: () => {}, version: 0 });
export function useCall() {
  return useContext(CallContext);
}

export function micMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "Your browser is blocking the microphone. Click the lock or settings icon next to the web address, set Microphone to Allow, then tap Call again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Plug in a headset or check that your computer's microphone is on, then try again.";
  if (name === "NotReadableError" || name === "AbortError") return "Your microphone is being used by another app. Close it (for example another call or video app) and try again.";
  return "Could not start the call. Check your microphone and internet connection, then try again.";
}

async function fetchToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/voice/token", { cache: "no-store" });
    if (!response.ok) return null;
    return ((await response.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export function CallProvider({ enabled: allowed, children }: { enabled: boolean; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [version, setVersion] = useState(0);
  const [sid, setSid] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hadAnswer, setHadAnswer] = useState(false);
  const device = useRef<VoiceDevice | null>(null);
  const call = useRef<VoiceCall | null>(null);
  const outcomeTouched = useRef(false);
  const deviceReady = useRef<Promise<VoiceDevice | null> | null>(null);

  const ensureDevice = useCallback((): Promise<VoiceDevice | null> => {
    if (deviceReady.current) return deviceReady.current;
    deviceReady.current = (async () => {
      const token = await fetchToken();
      if (!token) { deviceReady.current = null; return null; }
      const { Device } = await import("@twilio/voice-sdk");
      const dev = new Device(token, { closeProtection: true, codecPreferences: ["opus", "pcmu"] } as never) as unknown as VoiceDevice;
      dev.on("tokenWillExpire", async () => { const next = await fetchToken(); if (next) dev.updateToken(next); });
      dev.on("error", (...args) => {
        const e = args[0] as { code?: number; message?: string } | undefined;
        if (e?.code === 31208) setError(micMessage({ name: "NotAllowedError" }));
        else if (e?.code === 31201) setError(micMessage({ name: "NotFoundError" }));
        else if (e?.code === 20101 || e?.code === 20104) deviceReady.current = null;
      });
      dev.on("incoming", (...args) => {
        const incoming = args[0] as VoiceCall;
        if (call.current) { incoming.reject(); return; }
        attach(incoming, incoming.parameters?.From ?? "", "incoming");
      });
      device.current = dev;
      try { await dev.register(); } catch { /* incoming calls may not work; outgoing still can */ }
      return dev;
    })();
    return deviceReady.current;
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => { void ensureDevice(); }, 2500);
    return () => window.clearTimeout(timer);
  }, [allowed, ensureDevice]);

  useEffect(() => {
    if (phase !== "connected") return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [phase]);

  function attach(next: VoiceCall, who: string, startPhase: Phase) {
    call.current = next;
    setSid(next.parameters?.CallSid ?? "");
    setMuted(false); setKeypad(false); setSeconds(0); setError(""); setOutcome(""); setNotes(""); setSaveError(""); setHadAnswer(false);
    outcomeTouched.current = false;
    if (startPhase === "incoming") { setLabel(who); setNumber(who); }
    setPhase(startPhase);
    next.on("ringing", () => setPhase((p) => (p === "connecting" ? "ringing" : p)));
    next.on("accept", () => { setSid(next.parameters?.CallSid ?? ""); setHadAnswer(true); setPhase("connected"); });
    const finish = () => { call.current = null; setPhase("ended"); };
    next.on("disconnect", finish);
    next.on("cancel", finish);
    next.on("reject", finish);
    next.on("error", (...args) => {
      const e = args[0] as { code?: number } | undefined;
      setError(e?.code === 31208 ? micMessage({ name: "NotAllowedError" }) : "The call dropped. Check your internet connection and try again.");
      finish();
    });
  }

  const startCall = useCallback(async ({ number: raw, name }: { number: string; name?: string }) => {
    const e164 = dialNumber(raw);
    if (!allowed || !e164) { window.location.href = `tel:${raw.replace(/[^\d+]/g, "")}`; return; }
    if (call.current) return;
    setLabel(name || raw); setNumber(raw); setError(""); setPhase("connecting"); setOutcome(""); setNotes(""); setSid(""); setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError("This browser can't use the microphone here. Try Chrome, Safari or Edge on the CRM's secure address."); setPhase("ended"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (e) { setError(micMessage(e)); setPhase("ended"); return; }
    const dev = await ensureDevice();
    if (!dev) { setError("Calling isn't available right now. Please try again in a minute, or use your phone's keypad."); setPhase("ended"); return; }
    try {
      const outgoing = await dev.connect({ params: { To: e164 } });
      attach(outgoing, name || raw, "connecting");
    } catch (e) { setError(micMessage(e)); setPhase("ended"); }
  }, [allowed, ensureDevice]);

  // After hang up, pre-fill the outcome from what Twilio reports.
  useEffect(() => {
    if (phase !== "ended" || !sid) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 6 && !cancelled; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const info = await getCallStatusAction(sid);
        if (cancelled || !info) continue;
        const guess = suggestOutcome(info.status, info.durationSeconds);
        if (guess && !outcomeTouched.current) { setOutcome(guess); return; }
        if (info.status === "completed" || ["busy", "no-answer", "failed", "canceled"].includes(info.status)) return;
      }
    })();
    return () => { cancelled = true; };
  }, [phase, sid]);

  function close() { setPhase("idle"); setError(""); }

  async function save() {
    if (!sid) { close(); return; }
    if (!outcome) { setSaveError("Pick what happened on the call."); return; }
    setSaving(true); setSaveError("");
    let result = await saveCallOutcomeAction(sid, outcome, notes);
    for (let i = 0; i < 3 && !result.ok && /not in the log/.test(result.error ?? ""); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      result = await saveCallOutcomeAction(sid, outcome, notes);
    }
    setSaving(false);
    if (!result.ok) { setSaveError(result.error ?? "Could not save."); return; }
    setVersion((v) => v + 1);
    close();
  }

  const value = useMemo<Ctx>(() => ({ enabled: allowed, startCall: (input) => { void startCall(input); }, version }), [allowed, startCall, version]);
  const live = phase === "connecting" || phase === "ringing" || phase === "connected";

  return (
    <CallContext.Provider value={value}>
      {children}
      {phase !== "idle" ? (
        <div role="dialog" aria-label="Phone call" className="fixed inset-x-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto w-auto max-w-sm rounded-3xl border bg-card p-4 shadow-2xl lg:inset-x-auto lg:bottom-6 lg:right-6 lg:mx-0">
          <p className="truncate font-heading text-lg font-semibold text-foreground">{label}</p>
          {label !== number ? <p className="truncate text-sm text-muted-foreground">{number}</p> : null}
          {phase === "incoming" ? (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700"><PhoneIncoming className="size-4" /> Incoming call to the Cora number</p>
              <div className="mt-3 flex gap-2">
                <Button className="min-h-11 flex-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={async () => {
                  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); call.current?.accept(); }
                  catch (e) { setError(micMessage(e)); }
                }}><Phone className="size-4" /> Answer</Button>
                <Button variant="outline" className="min-h-11 flex-1 rounded-full text-red-600" onClick={() => { call.current?.reject(); }}><PhoneOff className="size-4" /> Decline</Button>
              </div>
            </>
          ) : null}
          {live ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                {phase === "connecting" ? "Calling…" : phase === "ringing" ? "Ringing…" : `Connected · ${formatDuration(seconds)}`}
              </p>
              {keypad ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                    <button key={digit} type="button" className="h-11 rounded-xl border bg-background text-lg font-medium active:bg-muted" onClick={() => call.current?.sendDigits(digit)}>{digit}</button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" className={cn("min-h-11 flex-1 rounded-full", muted && "bg-amber-100")} aria-pressed={muted} onClick={() => { const next = !muted; call.current?.mute(next); setMuted(next); }}>
                  {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />} {muted ? "Unmute" : "Mute"}
                </Button>
                <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-full" aria-pressed={keypad} onClick={() => setKeypad((v) => !v)}><Grid3x3 className="size-4" /> Keypad</Button>
                <Button type="button" className="min-h-11 flex-1 rounded-full bg-red-600 text-white hover:bg-red-700" onClick={() => call.current?.disconnect()}><PhoneOff className="size-4" /> Hang up</Button>
              </div>
            </>
          ) : null}
          {error ? <p className="mt-2 rounded-xl bg-red-50 p-2 text-sm text-red-800" role="alert">{error}</p> : null}
          {phase === "ended" ? (
            sid ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-foreground">{hadAnswer ? `Call ended · ${formatDuration(seconds)}` : "Call ended"}. What happened?</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CALL_OUTCOMES.map((item) => (
                    <button key={item.value} type="button" aria-pressed={outcome === item.value}
                      className={cn("min-h-10 rounded-full border px-3 text-sm", outcome === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                      onClick={() => { outcomeTouched.current = true; setOutcome(item.value); }}>{item.label}</button>
                  ))}
                </div>
                <textarea className="mt-2 min-h-16 w-full rounded-xl border bg-background p-2 text-sm" placeholder="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
                {saveError ? <p className="mt-1 text-sm text-red-700" role="alert">{saveError}</p> : null}
                <div className="mt-2 flex gap-2">
                  <Button className="min-h-11 flex-1 rounded-full" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save call"}</Button>
                  <Button variant="outline" className="min-h-11 rounded-full" onClick={close}>Skip</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="mt-3 min-h-11 w-full rounded-full" onClick={close}>Close</Button>
            )
          ) : null}
        </div>
      ) : null}
    </CallContext.Provider>
  );
}

/** A Call button for any phone number. Falls back to the phone's own dialer when browser calling is off. */
export function CallButton({ number, name, label = "Call", className }: { number: string; name?: string; label?: string; className?: string }) {
  const { startCall } = useCall();
  return (
    <button type="button" onClick={() => startCall({ number, name })}
      className={cn("inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground", className)}>
      <Phone className="size-3.5" /> {label}
    </button>
  );
}
