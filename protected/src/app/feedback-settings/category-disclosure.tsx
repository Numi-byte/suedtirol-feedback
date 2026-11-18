import Image from "next/image";
import type { ReactNode } from "react";

export function CategoryDisclosure({
  enabled,
  label,
  children,
}: {
  enabled: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <details className="feedback-category-disclosure">
      <summary aria-label={label} title={label}>
        <Image
          className="category-arrow-right"
          src="/icons/vectorarrowright.svg"
          width={10}
          height={20}
          alt=""
          aria-hidden="true"
        />
        <Image
          className="category-arrow-down"
          src="/icons/vectorarrowdown.svg"
          width={20}
          height={10}
          alt=""
          aria-hidden="true"
        />
      </summary>
      <div className="feedback-category-disclosure-fields">{children}</div>
    </details>
  );
}
