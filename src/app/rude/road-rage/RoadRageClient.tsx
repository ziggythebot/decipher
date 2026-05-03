"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createLocalAudioTrack,
  LocalAudioTrack,
  Participant,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from "livekit-client";

type ActiveSession = {
  id: string;
  startedAt: number;
  livekit: { url: string; token: string; roomName: string; dispatchCreated?: boolean } | null;
};

type MicPublication = TrackPublication & { audioTrack?: Track; trackSid: string; isMuted?: boolean };
type MuteCapableTrack = Track & { mute: () => Promise<void>; unmute: () => Promise<void> };

const ANGER_EMOJIS = ["😤", "😠", "🤬", "💢", "🚨"];
const ANGER_LABELS = ["Grumpy", "Annoyed", "Ranting", "Losing it", "MELTDOWN"];
const ANGER_COLORS = [
  "from-orange-900/50 to-red-950",
  "from-red-900/50 to-red-950",
  "from-red-800/60 to-red-950",
  "from-red-700/70 to-red-950",
  "from-red-600/80 to-red-950",
];

export function RoadRageClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "connecting" | "live" | "ending" | "done">("idle");
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [pttActive, setPttActive] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [lastSaid, setLastSaid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [angerLevel, setAngerLevel] = useState(2); // Jean-Pierre starts at level 2

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pttStartedAtRef = useRef<number | null>(null);
  const activeRef = useRef<ActiveSession | null>(null);
  const elapsedRef = useRef<number>(0);
  const explicitMicTrackRef = useRef<LocalAudioTrack | null>(null);
  activeRef.current = active;
  elapsedRef.current = elapsed;

  // Auto-start on mount
  useEffect(() => {
    void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      room?.disconnect();
      for (const el of audioElementsRef.current.values()) el.remove();
      audioElementsRef.current.clear();
      explicitMicTrackRef.current?.stop();
    };
  }, [room]);

  // --- Audio helpers ---

  function clearAttachedAudio() {
    for (const el of audioElementsRef.current.values()) el.remove();
    audioElementsRef.current.clear();
  }

  function attachTrackAudio(track: Track, publication: TrackPublication) {
    if (track.kind !== Track.Kind.Audio) return;
    if (audioElementsRef.current.has(publication.trackSid)) return;
    const el = track.attach() as HTMLAudioElement;
    el.autoplay = true;
    el.muted = false;
    el.setAttribute("playsinline", "true");
    el.style.display = "none";
    document.body.appendChild(el);
    audioElementsRef.current.set(publication.trackSid, el);
    void el.play().catch(() => setMessage("Audio blocked — tap Connect Audio to retry."));
  }

  function detachTrackAudio(track: Track, publication: TrackPublication) {
    const el = audioElementsRef.current.get(publication.trackSid);
    if (!el) return;
    track.detach(el);
    el.remove();
    audioElementsRef.current.delete(publication.trackSid);
  }

  function attachParticipantAudio(participant: Participant) {
    for (const pub of participant.trackPublications.values()) {
      if (pub.kind !== Track.Kind.Audio) continue;
      if ("setSubscribed" in pub) (pub as RemoteTrackPublication).setSubscribed(true);
      if (pub.track) attachTrackAudio(pub.track, pub);
    }
  }

  function getMicPublication(r: Room): MicPublication | null {
    const pub = Array.from(r.localParticipant.trackPublications.values()).find(
      (p) => p.source === Track.Source.Microphone
    );
    return (pub as MicPublication | undefined) ?? null;
  }

  function getMuteCapableMicTrack(pub: MicPublication | null): MuteCapableTrack | null {
    const candidate = pub?.audioTrack ?? pub?.track ?? null;
    if (!candidate) return null;
    const c = candidate as unknown as { mute?: unknown; unmute?: unknown };
    if (typeof c.mute !== "function" || typeof c.unmute !== "function") return null;
    return candidate as unknown as MuteCapableTrack;
  }

  async function setMicMuted(r: Room, muted: boolean): Promise<boolean> {
    const track = getMuteCapableMicTrack(getMicPublication(r));
    if (!track) return false;
    if (muted) await track.mute(); else await track.unmute();
    return true;
  }

  async function waitForMicPublication(r: Room, timeoutMs = 2500): Promise<boolean> {
    if (getMicPublication(r)) return true;
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        r.off(RoomEvent.LocalTrackPublished, handler);
        resolve(false);
      }, timeoutMs);
      const handler = (pub: TrackPublication) => {
        if (pub.source !== Track.Source.Microphone) return;
        window.clearTimeout(timer);
        r.off(RoomEvent.LocalTrackPublished, handler);
        resolve(true);
      };
      r.on(RoomEvent.LocalTrackPublished, handler);
    });
  }

  // --- Session management ---

  async function startSession() {
    setPhase("loading");
    try {
      const res = await fetch("/api/speak/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "rude", scenarioType: "road_rage" }),
      });
      if (!res.ok) {
        setMessage("Couldn't start session — try again.");
        setPhase("idle");
        return;
      }
      const data = (await res.json()) as {
        session: { id: string; createdAt: string; scenarioType: string | null };
        livekit: { url: string; token: string; roomName: string; dispatchCreated?: boolean } | null;
      };
      setActive({ id: data.session.id, startedAt: Date.now(), livekit: data.livekit });
      setPhase("ready");
    } catch {
      setMessage("Connection error — try again.");
      setPhase("idle");
    }
  }

  async function connectAudio() {
    if (!active?.livekit) return;
    setPhase("connecting");
    const sessionId = active.id;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      const nextRoom = new Room({
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      nextRoom.on("disconnected", () => {
        setRoom(null);
        setPhase("idle");
        clearAttachedAudio();
        const a = activeRef.current;
        if (a) {
          setActive(null);
          void fetch("/api/speak/session/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: a.id, durationSec: elapsedRef.current }),
          });
        }
      });

      nextRoom.on(RoomEvent.TrackSubscribed, (track, pub) => attachTrackAudio(track, pub));
      nextRoom.on(RoomEvent.TrackUnsubscribed, (track, pub) => detachTrackAudio(track, pub));
      nextRoom.on(RoomEvent.TrackPublished, (pub, participant) => {
        if (participant.identity === nextRoom.localParticipant.identity) return;
        if (pub.kind !== Track.Kind.Audio) return;
        if ("setSubscribed" in pub) (pub as RemoteTrackPublication).setSubscribed(true);
      });
      nextRoom.on(RoomEvent.ParticipantConnected, (p) => attachParticipantAudio(p));

      nextRoom.on(RoomEvent.DataReceived, (payload) => {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
            type?: string;
            text?: string;
            message?: string;
          };
          if (parsed.type === "user_transcribed" && parsed.text) setLastHeard(parsed.text);
          if (parsed.type === "agent_utterance" && parsed.text) {
            setLastSaid(parsed.text);
            // Heuristic anger detection from Jean-Pierre's text
            const t = parsed.text.toUpperCase();
            const swearCount = (t.match(/PUTAIN|MERDE|CONNARD|FOUTRE|ENCULÉ|ZE FUCK|MON DIEU|CASSE-TOI/g) ?? []).length;
            const capsRatio = (t.match(/[A-Z]/g) ?? []).length / Math.max(t.length, 1);
            if (swearCount >= 3 || capsRatio > 0.6) setAngerLevel((l) => Math.min(5, l + 1));
            else if (swearCount === 0 && capsRatio < 0.2) setAngerLevel((l) => Math.max(1, l - 1));
          }
          if (parsed.type === "agent_error" && parsed.message) setMessage(parsed.message);
        } catch { /* ignore */ }
      });

      await nextRoom.connect(active.livekit.url, active.livekit.token);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      let micPublished = await waitForMicPublication(nextRoom);
      if (!micPublished) {
        const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
        await nextRoom.localParticipant.publishTrack(track);
        explicitMicTrackRef.current = track;
        micPublished = await waitForMicPublication(nextRoom);
      }
      if (!micPublished) throw new Error("Mic not published");
      await setMicMuted(nextRoom, true);
      const micPub = getMicPublication(nextRoom);
      void nextRoom.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: "mic_ready", hasMicPublication: true, trackSid: micPub?.trackSid ?? null })),
        { reliable: true }
      );
      for (const p of nextRoom.remoteParticipants.values()) attachParticipantAudio(p);
      setRoom(nextRoom);
      setPhase("live");
      void persistSessionEvent(sessionId, "session_start", "Road rage session started");
    } catch {
      setMessage("Couldn't connect mic — check browser permissions.");
      setPhase("ready");
    }
  }

  async function beginPTT() {
    if (!room || phase !== "live" || pttActive) return;
    try {
      pttStartedAtRef.current = Date.now();
      let pub = getMicPublication(room);
      if (!pub) {
        await room.localParticipant.setMicrophoneEnabled(true);
        pub = getMicPublication(room);
      }
      if (!pub) { setMessage("Mic not ready — reconnect audio."); return; }
      await setMicMuted(room, false);
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: "ptt_press", hasMicPublication: true })),
        { reliable: true }
      );
      setPttActive(true);
    } catch { setMessage("Couldn't enable mic."); }
  }

  async function endPTT() {
    if (!room || !pttActive) return;
    try {
      const holdMs = pttStartedAtRef.current ? Date.now() - pttStartedAtRef.current : null;
      const pub = getMicPublication(room);
      const muted = await setMicMuted(room, true);
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: "ptt_release", holdMs, hasMicPublication: !!pub, micMutedBeforeRelease: muted || pub?.isMuted || null })),
        { reliable: true }
      );
      setPttActive(false);
      pttStartedAtRef.current = null;
    } catch { setMessage("Mic error."); }
  }

  async function endSession() {
    if (!active || phase === "ending") return;
    setPhase("ending");
    room?.disconnect();
    clearAttachedAudio();
    try {
      await fetch("/api/speak/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: active.id, durationSec: elapsed }),
      });
    } catch { /* best effort */ }
    setActive(null);
    setPhase("done");
  }

  async function persistSessionEvent(sessionId: string, type: string, text: string) {
    try {
      await fetch("/api/speak/session/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type, text }),
      });
    } catch { /* best effort */ }
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  // --- Render ---

  const anger = Math.max(0, Math.min(4, angerLevel - 1));

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🚕</div>
          <h2 className="text-2xl font-black mb-2 text-white">Survived.</h2>
          <p className="text-zinc-400 text-sm mb-8">Jean-Pierre will never forget you.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => { setPhase("idle"); setActive(null); setElapsed(0); setAngerLevel(2); setLastHeard(null); setLastSaid(null); void startSession(); }}
              className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors">
              Go Again →
            </button>
            <button onClick={() => router.push("/rude")}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors">
              Back to Rude Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${ANGER_COLORS[anger]} text-white flex flex-col transition-all duration-1000`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <button onClick={() => router.push("/rude")} className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Rude Mode
        </button>
        {active && (
          <span className="text-zinc-400 text-sm font-mono">{formatElapsed(elapsed)}</span>
        )}
      </div>

      {/* Jean-Pierre */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">

        {/* Anger indicator */}
        <div className="text-7xl mb-3 transition-all duration-500">{ANGER_EMOJIS[anger]}</div>
        <div className="text-sm font-bold text-red-300 mb-1 uppercase tracking-widest">
          Jean-Pierre
        </div>
        <div className={`text-xs font-semibold mb-6 px-3 py-1 rounded-full border ${
          anger >= 3 ? "border-red-500 text-red-400 bg-red-950/50" : "border-orange-700 text-orange-400 bg-orange-950/30"
        }`}>
          {ANGER_LABELS[anger]}
        </div>

        {/* Anger meter */}
        <div className="flex gap-1.5 mb-8">
          {[0,1,2,3,4].map((i) => (
            <div key={i} className={`h-2 w-8 rounded-full transition-all duration-500 ${
              i <= anger ? (anger >= 3 ? "bg-red-500" : "bg-orange-500") : "bg-zinc-800"
            }`} />
          ))}
        </div>

        {/* Last said by Jean-Pierre */}
        {lastSaid && (
          <div className="bg-black/30 rounded-2xl px-4 py-3 mb-4 max-w-sm text-sm text-zinc-200 leading-relaxed italic">
            "{lastSaid}"
          </div>
        )}

        {/* What you said */}
        {lastHeard && (
          <div className="text-zinc-500 text-xs mb-4">
            You: "{lastHeard}"
          </div>
        )}

        {/* Status message */}
        {message && (
          <p className="text-xs text-zinc-400 mb-4 max-w-xs">{message}</p>
        )}

        {/* Phase-specific UI */}
        {phase === "loading" && (
          <div className="text-zinc-400 text-sm animate-pulse">Hailing the cab...</div>
        )}

        {phase === "ready" && (
          <button
            onClick={() => void connectAudio()}
            className="bg-red-700 hover:bg-red-600 text-white font-black py-4 px-10 rounded-2xl text-lg transition-colors"
          >
            Get In The Cab →
          </button>
        )}

        {phase === "connecting" && (
          <div className="text-orange-400 text-sm animate-pulse">Connecting to Jean-Pierre...</div>
        )}

        {phase === "live" && (
          <button
            onPointerDown={() => void beginPTT()}
            onPointerUp={() => void endPTT()}
            onPointerLeave={() => void endPTT()}
            className={`w-40 h-40 rounded-full font-black text-lg transition-all select-none touch-none ${
              pttActive
                ? "bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.6)]"
                : "bg-zinc-800 hover:bg-zinc-700 active:scale-95"
            }`}
          >
            {pttActive ? "🎙️ Talking" : "Hold to\nTalk"}
          </button>
        )}
      </div>

      {/* End session */}
      {(phase === "live" || phase === "ready") && (
        <div className="px-4 pb-8">
          <button
            onClick={() => void endSession()}
            disabled={phase !== "live" && phase !== "ready"}
            className="w-full max-w-sm mx-auto block bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-40 text-zinc-400 text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Get Out Of The Cab
          </button>
        </div>
      )}
    </div>
  );
}
