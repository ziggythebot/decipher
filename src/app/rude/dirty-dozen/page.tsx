import { DirtyDozenClient } from "./DirtyDozenClient";
import { DIRTY_DOZEN } from "@/lib/rude/content";

export default function DirtyDozenPage() {
  return <DirtyDozenClient phrases={DIRTY_DOZEN} />;
}
