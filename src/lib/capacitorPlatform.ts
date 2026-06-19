import { Capacitor } from "@capacitor/core";

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}
