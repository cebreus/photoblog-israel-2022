import { EventEmitter } from "node:events";

export type SystemEvent = {
  type: "task:started" | "task:progress" | "task:completed" | "task:failed";
  gallery: string;
  task: {
    id: string;
    label: string;
    progress?: number;
    error?: string;
  };
  timestamp: number;
};

// Singleton event emitter instance
export const systemEvents = new EventEmitter();

export function emitSystemEvent(
  gallery: string,
  event: Omit<SystemEvent, "gallery" | "timestamp">,
) {
  systemEvents.emit("system:event", {
    ...event,
    gallery,
    timestamp: Date.now(),
  });
}
