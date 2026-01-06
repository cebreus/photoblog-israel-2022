import type { RequestEvent } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { type SystemEvent, systemEvents } from "$lib/server/events";

export async function GET({ locals }: RequestEvent) {
  if (!dev) {
    throw error(403, "System events are restricted to DEV mode.");
  }

  const { log } = locals;
  log.info({}, "SSE client connected to system events");

  let sendEvent: ((event: SystemEvent) => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      sendEvent = (event: SystemEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          log.warn({ err }, "Failed to enqueue SSE event");
          if (sendEvent) systemEvents.off("system:event", sendEvent);
        }
      };

      // Send initial heartbeat
      sendEvent({
        type: "task:completed",
        gallery: "",
        task: { id: "heartbeat", label: "" },
        timestamp: Date.now(),
      });

      // Listen to system events
      systemEvents.on("system:event", sendEvent);
    },
    cancel() {
      if (sendEvent) {
        systemEvents.off("system:event", sendEvent);
      }
      log.info({}, "SSE client disconnected from system events");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
