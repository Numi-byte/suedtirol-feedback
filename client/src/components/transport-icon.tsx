import Image from "next/image";
import busIcon from "@/components/Bus.png";
import trainIcon from "@/components/transportation_type-train.svg";
import cableCarIcon from "@/components/Cable Car.png";
import type { Language } from "@/lib/i18n";

export type TransportType = "bus" | "train" | "cable_car";
const names = {
  de: { bus: "Bus", train: "Zug", cable_car: "Seilbahn" },
  it: { bus: "Autobus", train: "Treno", cable_car: "Funivia" },
  en: { bus: "Bus", train: "Train", cable_car: "Cable car" },
};

const icons = { bus: busIcon, train: trainIcon, cable_car: cableCarIcon };

export function TransportIcon({ type = "bus", language, size = 28, priority = false }: {
  type?: TransportType; language: Language; size?: number; priority?: boolean;
}) {
  return <span className="transport-icon" role="img" aria-label={names[language][type]} title={names[language][type]}
    style={{ width: size, height: size }}>
    <Image src={icons[type]} width={size} height={size} alt="" priority={priority} />
  </span>;
}
