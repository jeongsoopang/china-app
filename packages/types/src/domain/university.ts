import type { BaseEntity } from "./common";

export type University = BaseEntity & {
  name: string;
  shortName: string;
  slug: string;
  city: string;
  countryCode: string;
  isActive: boolean;
};
