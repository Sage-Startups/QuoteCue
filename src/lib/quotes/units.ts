import type { ServiceUnit } from "@/generated/prisma/enums";

export const UNIT_LABELS: Record<ServiceUnit, string> = {
  HOUR: "Hour",
  DAY: "Day",
  ITEM: "Item",
  METRE: "Metre",
  SQUARE_METRE: "Square metre",
  VISIT: "Visit",
  FIXED: "Fixed price",
};

export const UNIT_SHORT: Record<ServiceUnit, string> = {
  HOUR: "hr",
  DAY: "day",
  ITEM: "item",
  METRE: "m",
  SQUARE_METRE: "m²",
  VISIT: "visit",
  FIXED: "fixed",
};
