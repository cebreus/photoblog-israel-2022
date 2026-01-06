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

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(event: SystemEvent) {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Send initial heartbeat
      sendEvent({
        type: "task:completed",
        gallery: "",
        task: { id: "heartbeat", label: "" },
        timestamp: Date.now(),
      });

      // Listen to system events
      systemEvents.on("system:event", sendEvent);

      // Cleanup on close
      return () => {
        systemEvents.off("system:event", sendEvent);
        log.info({}, "SSE client disconnected from system events");
      };
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
