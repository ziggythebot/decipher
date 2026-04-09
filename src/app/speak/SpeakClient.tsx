"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { SpeakScenarioSlug } from "@/lib/speak/scenarios";

type Scenario = {
  slug: SpeakScenarioSlug;
  title: string;
  desc: string;
};

type RecentSession = {
  id: string;
  createdAt: string;
  scenarioType: string | null;
  duration: number | null;
  xpEarned: number;
};

type Props = {
  scenarios: Scenario[];
  recentSessions: RecentSession[];
};

type DebugStageEvent = {
  stage: string;
  turnId: number | null;
  ts: number;
  detail: string | null;
};

type ActiveSession = {
  id: string;
  startedAt: number;
  scenarioType: string | null;
  livekit: {
    url: string;
    token: string;
    roomName: string;
    dispatchCreated?: boolean;
  } | null;
};

type MicPublication = TrackPublication & {
  isMuted?: boolean;
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatDuration(duration: number | null): string {
  if (duration === null) return "In progress";
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  return `${mins}m ${secs}s`;
}

export function SpeakClient({ scenarios, recentSessions }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [micDebug, setMicDebug] = useState<string | null>(null);
  const [debugStages, setDebugStages] = useState<DebugStageEvent[]>([]);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pttStartedAtRef = useRef<number | null>(null);
  const explicitMicTrackRef = useRef<LocalAudioTrack | null>(null);

  function getMicPublication(targetRoom: Room): MicPublication | null {
    const publication = Array.from(targetRoom.localParticipant.trackPublications.values()).find(
      (entry) => entry.source === Track.Source.Microphone
    );
    return (publication as MicPublication | undefined) ?? null;
  }

  async function waitForMicPublication(targetRoom: Room, timeoutMs = 2500): Promise<boolean> {
    if (getMicPublication(targetRoom)) return true;

    return await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        targetRoom.off(RoomEvent.LocalTrackPublished, handlePublished);
        resolve(false);
      }, timeoutMs);

      const handlePublished = (publication: TrackPublication) => {
        if (publication.source !== Track.Source.Microphone) return;
        window.clearTimeout(timer);
        targetRoom.off(RoomEvent.LocalTrackPublished, handlePublished);
        resolve(true);
      };

      targetRoom.on(RoomEvent.LocalTrackPublished, handlePublished);
    });
  }

  function clearAttachedAudio() {
    for (const element of audioElementsRef.current.values()) {
      element.remove();
    }
    audioElementsRef.current.clear();
  }

  function syncTutorAudioState() {
    if (audioElementsRef.current.size > 0) {
      setMessage("Connected to voice room. Tutor audio is live.");
      return;
    }
    setMessage("Connected to voice room. Waiting for tutor audio...");
  }

  function attachTrackAudio(track: Track, publication: TrackPublication) {
    if (track.kind !== Track.Kind.Audio) return;
    if (audioElementsRef.current.has(publication.trackSid)) return;
    const element = track.attach() as HTMLAudioElement;
    element.autoplay = true;
    element.muted = false;
    element.setAttribute("playsinline", "true");
    element.style.display = "none";
    document.body.appendChild(element);
    audioElementsRef.current.set(publication.trackSid, element);
    void element.play().catch(() => {
      setMessage("Tutor audio is blocked by the browser. Tap Connect Audio again to retry playback.");
    });
    syncTutorAudioState();
  }

  function detachTrackAudio(track: Track, publication: TrackPublication) {
    const element = audioElementsRef.current.get(publication.trackSid);
    if (!element) return;
    track.detach(element);
    element.remove();
    audioElementsRef.current.delete(publication.trackSid);
    syncTutorAudioState();
  }

  function attachParticipantAudio(participant: Participant) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind !== Track.Kind.Audio) continue;
      if ("setSubscribed" in publication) {
        (publication as RemoteTrackPublication).setSubscribed(true);
      }
      if (publication.track) {
        attachTrackAudio(publication.track, publication);
      }
    }
  }

  useEffect(() => {
    if (!active) return;

    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - active.startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [active]);

  const activeScenario = useMemo(() => {
    if (!active?.scenarioType) return "Freeform";
    return scenarios.find((s) => s.slug === active.scenarioType)?.title ?? active.scenarioType;
  }, [active, scenarios]);

  useEffect(() => {
    return () => {
      room?.disconnect();
      clearAttachedAudio();
    };
  }, [room, audioElementsRef]);

  async function persistSessionEvent(
    sessionId: string,
    type: "user_utterance" | "agent_utterance" | "error",
    text: string
  ) {
    try {
      await fetch("/api/speak/session/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type, text }),
      });
    } catch {
      // Best-effort persistence so live conversation is not blocked by transient API failures.
    }
  }

  async function startSession(scenarioType: SpeakScenarioSlug) {
    if (active || loading) return;
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/speak/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "guided", scenarioType }),
    });

    if (!response.ok) {
      setLoading(false);
      setMessage("Could not start session. Try again.");
      return;
    }

    const data = (await response.json()) as {
      session: { id: string; createdAt: string; scenarioType: string | null };
      livekit: { url: string; token: string; roomName: string; dispatchCreated?: boolean } | null;
    };

    setActive({
      id: data.session.id,
      startedAt: Date.now(),
      scenarioType: data.session.scenarioType,
      livekit: data.livekit,
    });
    setLastHeard(null);
    setDebugStages([]);
    setElapsed(0);
    setLoading(false);
    setMessage(
      data.livekit?.dispatchCreated
        ? "Session started. Connecting audio now should bring the tutor in."
        : "Session started. Audio room is up, but no agent worker was dispatched."
    );
  }

  async function connectAudio() {
    if (!active?.livekit || connecting || connected) return;
    const sessionId = active.id;
    setConnecting(true);
    setMessage(null);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of permissionStream.getTracks()) {
          track.stop();
        }
      }

      const nextRoom = new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      nextRoom.on("disconnected", () => {
        setConnected(false);
        setRoom(null);
        clearAttachedAudio();
        setMessage("Audio disconnected.");
      });
      nextRoom.on(RoomEvent.TrackSubscribed, (track, publication) => {
        attachTrackAudio(track, publication);
      });
      nextRoom.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
        detachTrackAudio(track, publication);
      });
      nextRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (participant.identity === nextRoom.localParticipant.identity) return;
        if (publication.kind !== Track.Kind.Audio) return;
        if ("setSubscribed" in publication) {
          (publication as RemoteTrackPublication).setSubscribed(true);
        }
      });
      nextRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        attachParticipantAudio(participant);
      });
      nextRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.source === Track.Source.Microphone) {
          setMicDebug("Mic track published.");
        }
      });
      nextRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (participant.identity !== nextRoom.localParticipant.identity) return;
        if (publication.source === Track.Source.Microphone) {
          setMicDebug("Mic muted.");
        }
      });
      nextRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        if (participant.identity !== nextRoom.localParticipant.identity) return;
        if (publication.source === Track.Source.Microphone) {
          setMicDebug("Mic unmuted.");
        }
      });
      nextRoom.on(RoomEvent.LocalAudioSilenceDetected, () => {
        setMicDebug("Mic published but silent input detected.");
      });
      nextRoom.on(RoomEvent.DataReceived, (payload) => {
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text) as {
            type?: string;
            text?: string;
            message?: string;
            stage?: string;
            textPreview?: string;
            reason?: string;
            state?: string;
            turnId?: number | null;
            ts?: number;
          };
          if (
            (parsed.type === "user_utterance" || parsed.type === "agent_utterance") &&
            typeof parsed.text === "string"
          ) {
            void persistSessionEvent(sessionId, parsed.type, parsed.text);
          }
          if (parsed.type === "user_transcribed" && typeof parsed.text === "string") {
            setLastHeard(parsed.text);
          }
          if (parsed.type === "debug_stage" && typeof parsed.stage === "string") {
            const detail =
              typeof parsed.textPreview === "string"
                ? parsed.textPreview
                : typeof parsed.reason === "string"
                  ? parsed.reason
                  : typeof parsed.state === "string"
                    ? parsed.state
                    : null;
            const event: DebugStageEvent = {
              stage: parsed.stage,
              turnId: typeof parsed.turnId === "number" ? parsed.turnId : null,
              ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
              detail,
            };
            setDebugStages((previous) => {
              const next = [...previous, event];
              return next.length > 24 ? next.slice(next.length - 24) : next;
            });
          }
          if (parsed.type === "agent_error" && typeof parsed.message === "string") {
            setMessage(`Tutor error: ${parsed.message}`);
          }
        } catch {
          // Ignore malformed payloads from remote participants.
        }
      });
      await nextRoom.connect(active.livekit.url, active.livekit.token);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      let micPublished = await waitForMicPublication(nextRoom);
      if (!micPublished) {
        const explicitTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await nextRoom.localParticipant.publishTrack(explicitTrack);
        explicitMicTrackRef.current = explicitTrack;
        micPublished = await waitForMicPublication(nextRoom);
      }
      if (!micPublished) {
        throw new Error("Microphone track was not published after fallback publish attempt.");
      }
      await nextRoom.localParticipant.setMicrophoneEnabled(false);
      const micPublication = getMicPublication(nextRoom);
      void nextRoom.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type: "mic_ready",
            hasMicPublication: true,
            trackSid: micPublication?.trackSid ?? null,
          })
        ),
        { reliable: true }
      );
      setMicDebug("Mic track published and live. Hold to Talk marks turn boundaries.");
      for (const participant of nextRoom.remoteParticipants.values()) {
        attachParticipantAudio(participant);
      }
      setRoom(nextRoom);
      setConnected(true);
      if (!active.livekit.dispatchCreated) {
        setMessage("Connected, but no tutor worker is online yet.");
      } else {
        syncTutorAudioState();
      }
    } catch {
      setMessage("Could not connect microphone/audio. Check browser mic permissions and try again.");
    } finally {
      setConnecting(false);
    }
  }

  function disconnectAudio() {
    if (room) {
      void room.localParticipant.setMicrophoneEnabled(false).catch(() => {
        // Ignore shutdown race errors if room already tearing down.
      });
    }
    room?.disconnect();
    if (explicitMicTrackRef.current) {
      explicitMicTrackRef.current.stop();
      explicitMicTrackRef.current = null;
    }
    setRoom(null);
    setConnected(false);
    setPttActive(false);
    clearAttachedAudio();
    setMessage("Disconnected from voice room.");
  }

  async function beginPushToTalk() {
    if (!room || !connected || pttActive) return;
    try {
      pttStartedAtRef.current = Date.now();
      let micPublication = getMicPublication(room);
      if (!micPublication) {
        await room.localParticipant.setMicrophoneEnabled(true);
        void waitForMicPublication(room, 1500);
        micPublication = getMicPublication(room);
      }
      if (!micPublication) {
        setMessage("Microphone track was not published. Reconnect audio and retry.");
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicDebug("Listening... speak while holding.");
      await room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type: "ptt_press",
            hasMicPublication: true,
          })
        ),
        { reliable: true }
      );
      setPttActive(true);
      setMessage("Listening... release to send.");
    } catch {
      setMessage("Could not enable microphone. Check browser mic permissions.");
    }
  }

  async function endPushToTalk() {
    if (!room || !connected || !pttActive) return;
    try {
      const holdMs = pttStartedAtRef.current ? Date.now() - pttStartedAtRef.current : null;
      const micPublication = getMicPublication(room);
      await room.localParticipant.setMicrophoneEnabled(false);
      setMicDebug("Turn sent. Waiting for transcript...");
      await room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type: "ptt_release",
            holdMs,
            hasMicPublication: !!micPublication,
            micMutedBeforeRelease: true,
          })
        ),
        { reliable: true }
      );
      setPttActive(false);
      pttStartedAtRef.current = null;
      setMessage("Processing your reply...");
    } catch {
      setMessage("Could not mute microphone cleanly.");
    }
  }

  async function endSession() {
    if (!active || ending) return;

    setEnding(true);
    setMessage(null);

    const response = await fetch("/api/speak/session/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: active.id, durationSec: elapsed }),
    });

    if (!response.ok) {
      setEnding(false);
      setMessage("Could not end session. Try again.");
      return;
    }

    const data = (await response.json()) as { totalGain?: number; level?: number };
    setMessage(`Session saved. +${data.totalGain ?? 0} XP${data.level ? ` • Level ${data.level}` : ""}`);

    room?.disconnect();
    setRoom(null);
    setConnected(false);
    setPttActive(false);
    setActive(null);
    setElapsed(0);
    setEnding(false);
    router.refresh();
  }

  return (
    <>
      <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-200">
        Session lifecycle is now active: start/end a scenario and track duration + XP.
        LiveKit room launch is wired; transcript/error enrichment remains in progress.
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Current session</p>
            <p className="text-xs text-zinc-400">
              {active ? `${activeScenario} • ${formatElapsed(elapsed)}` : "No active session"}
            </p>
          </div>
          <button
            type="button"
            disabled={!active || ending}
            onClick={endSession}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {ending ? "Saving..." : "End Session"}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-zinc-300">{message}</p>}
        {lastHeard && <p className="mt-1 text-xs text-emerald-300">Heard: {lastHeard}</p>}
        {micDebug && <p className="mt-1 text-xs text-amber-300">{micDebug}</p>}
        {active?.livekit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={connectAudio}
              disabled={connecting || connected}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
            >
              {connected ? "Audio Connected" : connecting ? "Connecting..." : "Connect Audio"}
            </button>
            <button
              type="button"
              onClick={disconnectAudio}
              disabled={!connected}
              className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-800"
            >
              Disconnect Audio
            </button>
            <button
              type="button"
              onMouseDown={() => void beginPushToTalk()}
              onMouseUp={() => void endPushToTalk()}
              onMouseLeave={() => void endPushToTalk()}
              onTouchStart={() => void beginPushToTalk()}
              onTouchEnd={() => void endPushToTalk()}
              disabled={!connected}
              className={`rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed ${
                pttActive ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {pttActive ? "Release to Send" : "Hold to Talk"}
            </button>
            <span className="self-center text-xs text-zinc-500">
              Room: {active.livekit.roomName}
            </span>
          </div>
        )}
        {active && !active.livekit && (
          <p className="mt-3 text-xs text-amber-300">
            LIVEKIT env vars are missing; session timing works but audio room connection is unavailable.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Debug Timeline</p>
        {debugStages.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No stage events yet.</p>
        ) : (
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {debugStages.map((event, index) => (
              <p key={`${event.ts}-${event.stage}-${index}`} className="text-xs text-zinc-300">
                {new Date(event.ts).toLocaleTimeString()} •
                {event.turnId ? ` turn ${event.turnId} •` : ""} {event.stage}
                {event.detail ? ` • ${event.detail}` : ""}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {scenarios.map((scenario) => (
          <article key={scenario.slug} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{scenario.slug}</p>
            <h2 className="mt-1 font-bold">{scenario.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{scenario.desc}</p>
            <button
              type="button"
              disabled={!!active || loading}
              onClick={() => startSession(scenario.slug)}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
            >
              {active ? "Session Active" : loading ? "Starting..." : "Start Session"}
            </button>
          </article>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Recent Sessions</h2>
        {recentSessions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            No completed speaking sessions yet.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {recentSessions.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {(session.scenarioType ?? "freeform").replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-zinc-500">{new Date(session.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatDuration(session.duration)} • +{session.xpEarned} XP
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
