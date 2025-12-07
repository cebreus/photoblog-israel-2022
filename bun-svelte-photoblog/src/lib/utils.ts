import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralizeCzech(
  count: number,
  forms: [string, string, string],
): string {
  if (count === 1) return forms[0];
  if (count >= 2 && count <= 4) return forms[1];
  return forms[2];
}

/**
 * Convenience helper to output a localized count plus the correct pluralized
 * noun form, e.g. `pluralizeCount(3, ['den','dny','dní'])` -> "3 dny".
 */
export function pluralizeCount(
  count: number,
  forms: [string, string, string],
): string {
  return `${count} ${pluralizeCzech(count, forms)}`;
}

// utility helpers

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
