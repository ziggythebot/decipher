/**
 * Encode a JSON data message for `LocalParticipant.publishData`.
 * livekit-client >= 2.22 types the payload as an ArrayBuffer-backed Uint8Array.
 * The bytes on the wire are unchanged: UTF-8 JSON.
 */
export function encodeDataMessage(payload: Record<string, unknown>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(payload)) as Uint8Array<ArrayBuffer>;
}
