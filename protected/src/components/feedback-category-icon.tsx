import { createElement, type ReactNode } from "react";
import { resolveFeedbackIcon } from "../../../shared/default-feedback-icons";
import type { IconNode } from "../../../shared/safe-feedback-icon";
export function FeedbackCategoryIcon({
  slug,
  icon,
}: {
  slug: string;
  icon: unknown;
}) {
  const safe = resolveFeedbackIcon(slug, icon);
  const render = (node: IconNode, key: string): ReactNode =>
    createElement(
      node.tag,
      { ...node.attrs, key },
      ...node.children.map((c, i) => render(c, `${key}-${i}`)),
    );
  return (
    <svg
      aria-hidden="true"
      viewBox={safe.viewBox.join(" ")}
      width={24}
      height={24}
      preserveAspectRatio="xMidYMid meet"
      {...safe.attrs}
    >
      {safe.nodes.map((n, i) => render(n, String(i)))}
    </svg>
  );
}
