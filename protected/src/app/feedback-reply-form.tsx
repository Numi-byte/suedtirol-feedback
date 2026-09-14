"use client";

import { useActionState, useState } from "react";
import { replyToFeedback } from "./actions";

type Reply = { body: string; updated_at: string };
type Labels = {
  answered: string;
  edit: string;
  editLabel: string;
  newLabel: string;
  privacy: string;
  publish: string;
  publishing: string;
  update: string;
  updating: string;
  cancel: string;
};

export function FeedbackReplyForm({ feedbackId, reply, labels }: { feedbackId: string; reply?: Reply; labels: Labels }) {
  const [editing, setEditing] = useState(!reply);
  const [state, formAction, pending] = useActionState(replyToFeedback, {});

  if (reply && !editing) {
    return <div className="existing-reply">
      <div className="existing-reply-heading">
        <span><span className="reply-check" aria-hidden="true">✓</span>{labels.answered}</span>
        <button type="button" className="reply-edit" onClick={() => setEditing(true)}>{labels.edit}</button>
      </div>
      <p>{reply.body}</p>
    </div>;
  }

  return <form action={formAction} className="reply-form" aria-busy={pending}>
    <input type="hidden" name="feedback_id" value={feedbackId} />
    <label htmlFor={`reply-${feedbackId}`}>{reply ? labels.editLabel : labels.newLabel}</label>
    <textarea id={`reply-${feedbackId}`} name="body" maxLength={2000} rows={3} defaultValue={reply?.body ?? ""} disabled={pending} required />
    <small>{labels.privacy}</small>
    {state.error ? <p className="reply-error" role="alert">{state.error}</p> : null}
    <div className="reply-actions">
      {reply ? <button type="button" className="reply-cancel" onClick={() => setEditing(false)} disabled={pending}>{labels.cancel}</button> : null}
      <button type="submit" disabled={pending}>
        {pending ? <span className="button-spinner" aria-hidden="true" /> : null}
        {pending ? (reply ? labels.updating : labels.publishing) : (reply ? labels.update : labels.publish)}
      </button>
    </div>
  </form>;
}
