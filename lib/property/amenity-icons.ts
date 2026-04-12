import {
  Accessibility,
  BellRing,
  Coffee,
  HeartPulse,
  ParkingCircle,
  ShieldAlert,
  Sun,
  ThermometerSun,
  Trees,
  Tv,
  Utensils,
  UtensilsCrossed,
  WashingMachine,
  Wifi,
  Wind,
  type LucideIcon,
  Check,
} from "lucide-react";

// Maps the `icon` string stored on each Amenity row to a lucide-react
// component. Falls back to a generic check mark for unknown values.
const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  "parking-circle": ParkingCircle,
  utensils: Utensils,
  "washing-machine": WashingMachine,
  wind: Wind,
  "thermometer-sun": ThermometerSun,
  tv: Tv,
  coffee: Coffee,
  "utensils-crossed": UtensilsCrossed,
  trees: Trees,
  sun: Sun,
  "bell-ring": BellRing,
  "shield-alert": ShieldAlert,
  "first-aid": HeartPulse,
  accessibility: Accessibility,
};

export function amenityIcon(name: string): LucideIcon {
  return ICONS[name] ?? Check;
}
