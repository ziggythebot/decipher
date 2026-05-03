import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { getActiveLanguage } from "@/lib/language/catalog";
import { DeconstructionClient } from "./DeconstructionClient";

export const dynamic = "force-dynamic";

export default async function DeconstructPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  const activeLanguage = getActiveLanguage(user);
  const profile = user.grammarProfiles.find((p) => p.languageCode === activeLanguage) ?? null;
  const alreadyCompleted = profile?.deconstructionDone ?? false;
  const initialProgress = profile?.deconstructionProgress ?? 0;

  return (
    <DeconstructionClient
      initialProgress={initialProgress}
      alreadyCompleted={alreadyCompleted}
    />
  );
}
