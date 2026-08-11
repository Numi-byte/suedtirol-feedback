"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "./actions";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="login-form">
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="name@company.com" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
      {state.error && <p className="login-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in to portal"}</button>
    </form>
  );
}
