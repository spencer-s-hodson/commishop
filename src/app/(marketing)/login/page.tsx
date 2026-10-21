import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/server/better-auth/server";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/overview");
  }

  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
