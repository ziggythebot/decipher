import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const targetPath = path.resolve(
  process.cwd(),
  "node_modules",
  "@livekit",
  "agents",
  "src",
  "voice",
  "generation.ts"
);

let source = readFileSync(targetPath, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (!source.includes(from)) {
    console.warn(`[patch-livekit] skipped missing pattern: ${label}`);
    return;
  }
  source = source.replace(from, to);
  changed = true;
  console.log(`[patch-livekit] patched: ${label}`);
}

function ensureContains(text, label) {
  if (!source.includes(text)) {
    console.warn(`[patch-livekit] missing expected content after patch: ${label}`);
    return;
  }
  console.log(`[patch-livekit] verified: ${label}`);
}

replaceOnce(
  "const TTS_READ_IDLE_TIMEOUT_MS = 10_000;",
  "const TTS_READ_IDLE_TIMEOUT_MS = 30_000;",
  "TTS read timeout 10s -> 30s"
);

replaceOnce(
  "const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 10_000;",
  "const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 30_000;",
  "Audio forward timeout 10s -> 30s"
);

replaceOnce(
  "      if (ttsStream === null) {\n        timedTextsFut.resolve(null);\n        await outputWriter.close();\n        await timedTextsWriter.close();\n        return;\n      }",
  "      if (ttsStream === null) {\n        timedTextsFut.resolve(null);\n        try {\n          await outputWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        try {\n          await timedTextsWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        return;\n      }",
  "Guard close on early-null TTS"
);

replaceOnce(
  "      await ttsStream?.cancel();\n      await outputWriter.close();\n      await timedTextsWriter.close();",
  "      await ttsStream?.cancel();\n      try {\n        await outputWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }\n      try {\n        await timedTextsWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }",
  "Guard close in finally"
);

if (changed) {
  writeFileSync(targetPath, source, "utf8");
  console.log(`[patch-livekit] wrote ${targetPath}`);
}

ensureContains("const TTS_READ_IDLE_TIMEOUT_MS = 30_000;", "TTS timeout at 30s");
ensureContains("const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 30_000;", "audio forward timeout at 30s");
ensureContains("if (!message.includes(\"WritableStream is closed\")) throw error;", "safe close guards");
