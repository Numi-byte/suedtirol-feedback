type PasswordClient = {
  auth: {
    updateUser(attributes: {
      password: string;
      current_password: string;
    }): PromiseLike<{ error: unknown }>;
  };
};
export async function changeOwnPassword(
  client: PasswordClient,
  form: FormData,
  verifyCurrent: (password: string) => Promise<boolean>,
): Promise<"success" | "invalid" | "mismatch" | "failed"> {
  const current = form.get("current_password"),
    password = form.get("password"),
    confirm = form.get("confirm_password");
  if (
    typeof current !== "string" ||
    !current ||
    current.length > 1024 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 1024 ||
    password === current
  )
    return "invalid";
  if (password !== confirm) return "mismatch";
  if (!(await verifyCurrent(current))) return "failed";
  const { error } = await client.auth.updateUser({
    password,
    current_password: current,
  });
  return error ? "failed" : "success";
}
