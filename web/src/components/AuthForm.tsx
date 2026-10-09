"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArcLogo } from "./ArcLogo";
import { AppleIcon, GoogleIcon, Icon } from "./Icon";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const signup = mode === "signup";
  const goIn = () => router.push("/projects");

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
          goIn();
        }}
      >
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input className="input" type="text" placeholder="e.g. Nithin" autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" placeholder="you@email.com" autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showPw ? "text" : "password"}
              placeholder={signup ? "8+ characters" : "Your password"}
              autoComplete={signup ? "new-password" : "current-password"}
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
        {!signup && (
          <div style={{ textAlign: "right" }}>
            <button type="button" className="link-btn small">
              Forgot password?
            </button>
          </div>
        )}

        <button type="submit" className="btn primary block" style={{ marginTop: 4 }}>
          {signup ? "Create account" : "Continue"}
        </button>

        <div className="or">or {signup ? "sign up" : "continue"} with</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" className="btn secondary" onClick={goIn}>
            <GoogleIcon /> Google
          </button>
          <button type="button" className="btn secondary" onClick={goIn}>
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
        <Link href={signup ? "/login" : "/signup"} className="link-btn">
          {signup ? "Log in" : "Sign up"}
        </Link>
      </div>
    </main>
  );
}
