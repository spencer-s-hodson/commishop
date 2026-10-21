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
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-heading text-2xl font-bold">
            Login to your account
          </h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
            disabled={pending}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Login"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            className="w-full"
            onClick={onGoogleSignIn}
          >
            <GoogleIcon />
            Login with Google
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
