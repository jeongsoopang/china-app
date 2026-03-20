import { redirect } from "next/navigation";
import { getGrandMasterAccessState } from "../lib/auth/grandmaster";

export default async function RootPage() {
  const accessState = await getGrandMasterAccessState();

  if (accessState.status === "allow") {
    redirect("/dashboard");
  }

  if (accessState.reason === "not_signed_in") {
    redirect("/login");
  }

  redirect("/access-denied");
}
