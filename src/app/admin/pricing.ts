// Pricing constants (as of 2026)
// Claude Sonnet 4.6: $3/M input, $15/M output
// Deepgram Nova-3 STT: $0.0043/min
// Deepgram Aura-2 TTS: $0.015/1k chars
export const PRICING = {
  inputPerMToken:  3.00,
  outputPerMToken: 15.00,
  sttPerMinute:    0.0043,
  ttsPerKChar:     0.015,
};
