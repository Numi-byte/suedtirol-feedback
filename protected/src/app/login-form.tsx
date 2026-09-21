"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "./actions";

const initialState: AuthState = {};

type LoginFormProps = {
  labels: {
    email: string; emailPlaceholder: string;
    password: string; passwordPlaceholder: string;
    submit: string; submitting: string;
  };
};

export function LoginForm({ labels }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="login-form">
      <label>{labels.email}<input name="email" type="email" autoComplete="email" placeholder={labels.emailPlaceholder} required /></label>
      <label>{labels.password}<input name="password" type="password" autoComplete="current-password" placeholder={labels.passwordPlaceholder} required /></label>
      {state.error && <p className="login-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? labels.submitting : labels.submit}</button>
    </form>
  );
}
