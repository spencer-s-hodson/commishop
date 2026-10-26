"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { GoogleIcon } from "@/components/google-icon";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { authClient } from "@/server/better-auth/client";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");
    const email = typeof emailValue === "string" ? emailValue : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/overview",
    });

    if (signInError) {
      setError(signInError.message ?? "Unable to sign in. Please try again.");
      setPending(false);
      return;
    }

    router.push("/overview");
    router.refresh();
  }

  async function onGoogleSignIn() {
    setError(null);
    setPending(true);

    const { error: socialError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/overview",
    });

    if (socialError) {
      setError(socialError.message ?? "Unable to sign in with Google.");
      setPending(false);
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={onSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            Sign in to pick up where you left off.
          </p>
        </div>
        <Field>
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            className="w-full"
            onClick={onGoogleSignIn}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </Field>
        <FieldSeparator>Or continue with email</FieldSeparator>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
