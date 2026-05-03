import { redirect } from "next/navigation";
import { AuthRequiredError, getOrCreateSessionUser } from "@/lib/session-user";
import { RoadRageClient } from "./RoadRageClient";

export const dynamic = "force-dynamic";

export default async function RoadRagePage() {
  let user;
  try {
    user = await getOrCreateSessionUser({ requireAuth: true });
  } catch (error) {
    if (error instanceof AuthRequiredError) redirect("/");
    throw error;
  }

  if (user.isBlocked) redirect("/dashboard");

  return <RoadRageClient />;
}
