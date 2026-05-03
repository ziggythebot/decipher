import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { ENABLED_LANGUAGES, LANGUAGE_CATALOG } from "@/lib/language/catalog";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      redirect("/");
    }
    throw error;
  }

  if (user.onboardedAt) {
    redirect("/dashboard");
  }

  const languages = [...ENABLED_LANGUAGES]
    .map((code) => LANGUAGE_CATALOG[code])
    .filter((l): l is (typeof LANGUAGE_CATALOG)[string] => Boolean(l));

  return <OnboardingClient languages={languages} />;
}
