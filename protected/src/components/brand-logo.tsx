import { StaLogo } from "@/components/sta-logo";

type BrandLogoProps = { tone?: "light" | "dark"; sub?: string };

/** Official südtirolmobil lockup, with the app name locked up beside it. */
export function BrandLogo({ tone = "light", sub = "feedback" }: BrandLogoProps) {
  return (
    <span className="brand-lockup" data-tone={tone}>
      <StaLogo />
      {sub ? <span className="brand-sub">{sub}</span> : null}
    </span>
  );
}
