"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { mutate } from "swr";
import { backend } from "@/lib/backend";
import { keys } from "@/lib/hooks";
import { ArcLogo } from "./ArcLogo";
import { AppleIcon, GoogleIcon, Icon } from "./Icon";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async () => {
    setError("");
    if (signup && password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    try {
      const user = signup ? await backend.signup({ name: name.trim(), email: email.trim(), password }) : await backend.login({ email: email.trim(), password });
      await mutate(keys.me, user, { revalidate: false });
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <main className="screen white" style={{ padding: "56px 28px 36px", gap: 22 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ArcLogo size={26} />
        <div>
          <h1 className="title" style={{ marginBottom: 6 }}>
            {signup ? "Start your arc." : "Welcome back"}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {signup ? "Every attempt tracked. Every change compared." : "Pick up where your last run left off."}
          </p>
        </div>
      </div>

      <form
        style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nithin" autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "8+ characters" : "Your password"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw(!showPw)}
              className="icon-btn sm"
              style={{ position: "absolute", right: 8, top: 9, background: "transparent" }}
            >
              <Icon name={showPw ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>
        </label>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn primary block" style={{ marginTop: 4 }} disabled={busy}>
          {busy ? "Please wait…" : signup ? "Create account" : "Continue"}
        </button>

        <div className="or">or {signup ? "sign up" : "continue"} with</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" className="btn secondary" onClick={() => setError("Google sign-in isn’t set up yet — use email for now.")}>
            <GoogleIcon /> Google
          </button>
          <button type="button" className="btn secondary" onClick={() => setError("Apple sign-in isn’t set up yet — use email for now.")}>
            <AppleIcon /> Apple
          </button>
        </div>

        {signup && (
          <p className="xs faint center" style={{ margin: 0, lineHeight: 1.6 }}>
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        )}
      </form>

      <div className="center">
        {signup ? "Already have an account? " : "Don't have an account? "}
        <Link href={`${signup ? "/login" : "/signup"}${next !== "/projects" ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-btn">
          {signup ? "Log in" : "Sign up"}
        </Link>
      </div>
    </main>
  );
}
