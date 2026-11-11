"use client";
import { useEffect, useRef, useState } from "react";
export function FeedbackPermissions({
  feedback,
  reply,
  feedbackLabel,
  replyLabel,
}: {
  feedback: boolean;
  reply: boolean;
  feedbackLabel: string;
  replyLabel: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = container.current?.closest("form");
    const reset = () => {
      setEnabled(feedback);
      setCanReply(feedback && reply);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [feedback, reply]);
  const [enabled, setEnabled] = useState(feedback);
  const [canReply, setCanReply] = useState(feedback && reply);
  return (
    <div ref={container} className="feedback-permission-group">
      <label>
        <input
          type="checkbox"
          name="feedback"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            if (!event.target.checked) setCanReply(false);
          }}
        />
        {feedbackLabel}
      </label>
      <label className="feedback-reply-permission">
        <input
          type="checkbox"
          name="reply_feedback"
          checked={canReply}
          disabled={!enabled}
          onChange={(event) => setCanReply(event.target.checked)}
        />
        {replyLabel}
      </label>
    </div>
  );
}
