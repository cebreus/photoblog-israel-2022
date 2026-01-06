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

class SystemEventEmitter extends EventEmitter {
  private static instance: SystemEventEmitter;

  static getInstance(): SystemEventEmitter {
    if (!SystemEventEmitter.instance) {
      SystemEventEmitter.instance = new SystemEventEmitter();
    }
    return SystemEventEmitter.instance;
  }

  emitSystemEvent(event: SystemEvent) {
    this.emit("system:event", event);
  }
}

export const systemEvents = SystemEventEmitter.getInstance();

export function emitSystemEvent(
  gallery: string,
  event: Omit<SystemEvent, "gallery" | "timestamp">,
) {
  systemEvents.emitSystemEvent({
    ...event,
    gallery,
    timestamp: Date.now(),
  });
}
