type ReplyAccessClient = {
  rpc(name: string): PromiseLike<{ data: unknown; error: unknown }>;
};
/** Resolve current database rights, including parent access and deactivation. */
export async function canReplyToFeedback(
  client: ReplyAccessClient,
): Promise<boolean> {
  const { data, error } = await client.rpc("can_reply_to_feedback");
  return !error && data === true;
}
