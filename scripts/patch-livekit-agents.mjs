import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const base = path.resolve(process.cwd(), "node_modules", "@livekit", "agents");
const files = [
  path.join(base, "src", "voice", "generation.ts"),
  path.join(base, "dist", "voice", "generation.js"),
  path.join(base, "dist", "voice", "generation.cjs"),
];

function patchFile(targetPath) {
  if (!existsSync(targetPath)) {
    console.warn(`[patch-livekit] missing file: ${targetPath}`);
    return;
  }
  let source = readFileSync(targetPath, "utf8");
  let changed = false;
  const isTs = targetPath.endsWith(".ts");

  const replacements = [
    ["const TTS_READ_IDLE_TIMEOUT_MS = 10_000;", "const TTS_READ_IDLE_TIMEOUT_MS = 30_000;"],
    ["const TTS_READ_IDLE_TIMEOUT_MS = 1e4;", "const TTS_READ_IDLE_TIMEOUT_MS = 3e4;"],
    ["const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 10_000;", "const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 30_000;"],
    ["const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 1e4;", "const FORWARD_AUDIO_IDLE_TIMEOUT_MS = 3e4;"],
    [
      "      if (ttsStream === null) {\n        timedTextsFut.resolve(null);\n        await outputWriter.close();\n        await timedTextsWriter.close();\n        return;\n      }",
      isTs
        ? "      if (ttsStream === null) {\n        timedTextsFut.resolve(null);\n        try {\n          await outputWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        try {\n          await timedTextsWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        return;\n      }"
        : "      if (ttsStream === null) {\n        timedTextsFut.resolve(null);\n        try {\n          await outputWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        try {\n          await timedTextsWriter.close();\n        } catch (error) {\n          const message = error instanceof Error ? error.message : String(error);\n          if (!message.includes(\"WritableStream is closed\")) throw error;\n        }\n        return;\n      }",
    ],
    [
      isTs
        ? "      await ttsStream?.cancel();\n      await outputWriter.close();\n      await timedTextsWriter.close();"
        : "      await (ttsStream == null ? void 0 : ttsStream.cancel());\n      await outputWriter.close();\n      await timedTextsWriter.close();",
      isTs
        ? "      await ttsStream?.cancel();\n      try {\n        await outputWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }\n      try {\n        await timedTextsWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }"
        : "      await (ttsStream == null ? void 0 : ttsStream.cancel());\n      try {\n        await outputWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }\n      try {\n        await timedTextsWriter.close();\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        if (!message.includes(\"WritableStream is closed\")) throw error;\n      }",
    ],
  ];

  for (const [from, to] of replacements) {
    if (source.includes(from)) {
      source = source.replace(from, to);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(targetPath, source, "utf8");
    console.log(`[patch-livekit] wrote ${targetPath}`);
  } else {
    console.log(`[patch-livekit] no changes for ${targetPath}`);
  }
}

for (const file of files) {
  patchFile(file);
}
