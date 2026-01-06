import { browser, dev } from "$app/environment";
import type { SystemEvent } from "$lib/server/events";

type TaskInfo = {
  id: string;
  label: string;
  startTime: number;
};

class SystemState {
  activeTask = $state<TaskInfo | null>(null);
  private eventSource: EventSource | null = null;

  constructor() {
    if (browser && dev) {
      this.connect();
    }
  }

  private connect() {
    if (this.eventSource) {
      return;
    }

    this.eventSource = new EventSource("/api/system/events");

    this.eventSource.onmessage = (event) => {
      try {
        const data: SystemEvent = JSON.parse(event.data);

        if (data.type === "task:started") {
          this.activeTask = {
            id: data.task.id,
            label: data.task.label,
            startTime: data.timestamp,
          };
        } else if (data.type === "task:completed" || data.type === "task:failed") {
          // Only clear if it matches the current task
          if (this.activeTask?.id === data.task.id) {
            this.activeTask = null;
          }
        }
      } catch {
        // Silently ignore parse errors
      }
    };

    this.eventSource.onerror = () => {
      // EventSource automatically reconnects
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const system = new SystemState();

// Cleanup on page unload
if (browser) {
  window.addEventListener("beforeunload", () => {
    system.disconnect();
  });
}
