import type { ClassSociety, ClassSocietyRecord, MaintenanceVessel } from "./types";

export const SUPPORTED_CLASS_SOCIETIES: ReadonlyArray<ClassSociety> = [
  "DNV",
  "LR",
  "RINA",
  "Bureau Veritas",
  "ABS",
  "ClassNK",
  "OTHER",
];

export interface ClassSocietyService {
  getRecord(vessel: MaintenanceVessel): ClassSocietyRecord | null;
  supportedSocieties(): ReadonlyArray<ClassSociety>;
  isLive(): boolean;
}

export function createMockClassSocietyService(record: ClassSocietyRecord | null): ClassSocietyService {
  return {
    getRecord() {
      return record;
    },
    supportedSocieties: () => [...SUPPORTED_CLASS_SOCIETIES],
    isLive: () => false,
  };
}
