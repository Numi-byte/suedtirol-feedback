"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANGUAGE_COOKIE, getTranslations } from "@/lib/language";
import { languages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export async function setLanguage(formData: FormData) {
  const requested = String(formData.get("language") ?? "");
  const language = languages.find((code) => code === requested);
  if (!language) return;
  (await cookies()).set(LANGUAGE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export type AuthState = { error?: string };

export async function signIn(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { t } = await getTranslations();
  if (!email || !password) return { error: t.login.errorEmpty };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: t.login.errorInvalid };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function createBusStop(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be authenticated to create a bus stop.");

  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Valid coordinates are required.");

  const { error } = await supabase.from("bus_stops").insert({
    name_de: String(formData.get("name_de") ?? "").trim(),
    name_it: String(formData.get("name_it") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    municipality: String(formData.get("municipality") ?? "").trim(),
    stop_code: String(formData.get("stop_code") ?? "").trim() || null,
    latitude,
    longitude,
    is_accessible: formData.get("is_accessible") === "on",
    is_published: formData.get("is_published") === "on",
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
