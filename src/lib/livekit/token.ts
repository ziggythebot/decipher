import { createHmac } from "node:crypto";

function toBase64Url(input: string | Buffer): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createLiveKitToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  room: string;
  name?: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSeconds ?? 60 * 60);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: opts.apiKey,
    sub: opts.identity,
    iat: now,
    nbf: now,
    exp,
    name: opts.name ?? opts.identity,
    video: {
      room: opts.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", opts.apiSecret).update(signingInput).digest();
  const encodedSignature = toBase64Url(signature);

  return `${signingInput}.${encodedSignature}`;
}
