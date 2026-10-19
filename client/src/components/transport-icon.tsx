import Image from "next/image";
import busIcon from "@/components/Bus.png";
import type { Language } from "@/lib/i18n";

export type TransportType = "bus" | "train" | "cable_car";
const names = {
  de: { bus: "Bus", train: "Zug", cable_car: "Seilbahn" },
  it: { bus: "Autobus", train: "Treno", cable_car: "Funivia" },
  en: { bus: "Bus", train: "Train", cable_car: "Cable car" },
};

export function TransportIcon({ type = "bus", language }: { type?: TransportType; language: Language }) {
  return <span className="transport-icon" role="img" aria-label={names[language][type]} title={names[language][type]}>
    {type === "bus" ? <Image src={busIcon} width={28} height={28} alt="" /> :
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {type === "train" ? <><rect x="5" y="3" width="14" height="15" rx="4" /><path d="M5 11h14M12 3v8M8 15h.01M16 15h.01M8 18l-3 3m11-3 3 3M8 21h8" /></> :
          <><path d="m2 6 20-4M12 4v5M8 9h8" /><rect x="5" y="9" width="14" height="12" rx="3" /><path d="M5 16h14M12 9v7" /></>}
      </svg>}
  </span>;
}
