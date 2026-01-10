import { browser, dev } from "$app/environment";
import type { SystemEvent } from "$lib/server/events";

type TaskInfo = {
  id: string;
  label: string;
  startTime: number;
};

function createSystemState() {
  let activeTask = $state<TaskInfo | null>(null);
  let eventSource: EventSource | null = null;

  function connect() {
    if (eventSource) {
      return;
    }

    eventSource = new EventSource("/api/system/events");

    eventSource.onmessage = function handleMessage(event) {
      try {
        const data: SystemEvent = JSON.parse(event.data);

        if (data.type === "task:started") {
          activeTask = {
            id: data.task.id,
            label: data.task.label,
            startTime: data.timestamp,
          };
        } else if (data.type === "task:completed" || data.type === "task:failed") {
          // Only clear if it matches the current task
          if (activeTask?.id === data.task.id) {
            activeTask = null;
          }
        }
      } catch {
        // Silently ignore parse errors
      }
    };

    eventSource.onerror = function handleError() {
      // EventSource automatically reconnects
    };
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  // Initialization (logic from constructor)
  if (browser && dev) {
    connect();
  }

  return {
    get activeTask() {
      return activeTask;
    },
    set activeTask(v) {
      activeTask = v;
    },
    disconnect,
  };
}

export const system = createSystemState();

// Cleanup on page unload
if (browser) {
  window.addEventListener("beforeunload", function handleUnload() {
    system.disconnect();
  });
}
