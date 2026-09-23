const FEEDBACK_REPLY_USER_IDS = new Set([
  "bdee91d9-c969-4bd4-b336-8f7e780ead3e",
  "bcd1c5c0-8bee-430b-ba38-75530e2b8a30",
]);

export function canReplyToFeedback(userId: string | undefined): boolean {
  return userId !== undefined && FEEDBACK_REPLY_USER_IDS.has(userId);
}
