import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { getSession } from "@/server/better-auth/server";

export default async function SignupPage() {
  const session = await getSession();
  if (session) {
    redirect("/overview");
  }

  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
