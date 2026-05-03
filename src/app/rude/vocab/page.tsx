import { RudeVocabClient } from "./RudeVocabClient";
import { SWEAR_WORDS } from "@/lib/rude/content";

export default function RudeVocabPage() {
  return <RudeVocabClient words={SWEAR_WORDS} />;
}
