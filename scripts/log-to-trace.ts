import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

/**
 * Trace Event Format: https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/preview
 */
type TraceEvent = {
  name: string;
  cat?: string;
  ph: string; // Phase: 'B' (Begin), 'E' (End), 'X' (Complete), 'i' (Instant)
  ts: number; // Microseconds
  pid: number;
  tid: number;
  dur?: number; // Microseconds (for 'X' phase)
  args?: Record<string, any>;
  id?: string;
};

const logger = createLogger("log-to-trace");

async function main() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      id: {
        type: "string",
        short: "i",
      },
      file: {
        type: "string",
        short: "f",
        default: "logs/dev.log",
      },
      out: {
        type: "string",
        short: "o",
        default: "trace.json",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const logPath = resolve(process.cwd(), values.file as string);
  const outPath = resolve(process.cwd(), values.out as string);
  const targetId = values.id;

  logger.info({ logPath }, "Reading logs");
  if (targetId) {
    logger.info({ targetId }, "Filtering for TraceID/RequestID");
  }

  let rawLog = "";
  try {
    rawLog = await readFile(logPath, "utf-8");
  } catch (e: any) {
    logger.error({ err: e }, `Failed to read log file: ${e.message}`);
    process.exit(1);
  }

  const events: TraceEvent[] = [
    { name: "thread_name", ph: "M", pid: 1, tid: 1, ts: 0, cat: "", args: { name: "Backend API" } },
    {
      name: "thread_name",
      ph: "M",
      pid: 1,
      tid: 2,
      ts: 0,
      cat: "",
      args: { name: "Frontend Request" },
    },
    { name: "thread_name", ph: "M", pid: 1, tid: 3, ts: 0, cat: "", args: { name: "Disk I/O" } },
  ];
  const lines = rawLog.split("\n");

  // Track PIDs for metadata
  const processes = new Set<number>();
  processes.add(1); // logical backend process

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Basic filtering
      let include = !targetId; // If no ID, include everything (might be huge)

      if (targetId) {
        // Direct match
        if (entry.requestId === targetId || entry.traceId === targetId) {
          include = true;
        }
        // Or if context has it
        else if (entry.reqId === targetId || entry.req?.id === targetId) {
          include = true;
        }
      }

      // If strict filtering is requested but generic logs appear continuously,
      // strict filtering is better for specific request debug.
      if (!include) continue;

      const ts = entry.time * 1000; // ms to us
      const pid = 1; // logical process ID for BE
      const tid = 1; // logical thread ID

      // Handle Request Complete events (Complete Event 'X')
      // Handle Request Complete events (Complete Event 'X')
      if (entry.durationMs !== undefined && entry.method && entry.path) {
        const endTimeUs = Math.round(entry.time * 1000);
        const durationUs = Math.round(entry.durationMs * 1000);
        const startTimeUs = endTimeUs - durationUs;

        events.push({
          name: `${entry.method} ${entry.path}`,
          cat: "http,api",
          ph: "X",
          ts: startTimeUs,
          dur: durationUs,
          pid,
          tid: 1,
          args: {
            status: entry.status,
            requestId: entry.requestId || entry.traceId,
            ...pick(entry, ["sourcePersonIds", "targetPersonId", "updated", "count"]),
          },
        });

        // Add sub-events for Performance metrics
        if (entry.perf) {
          let currentTs = startTimeUs;
          for (const [key, val] of Object.entries(entry.perf)) {
            const valNum = val as number;
            // Minimum 1us duration, integer
            const durUs = Math.max(1, Math.round(valNum * 1000));

            // Make name readable
            let shortName = key.replace(process.cwd(), ".");
            shortName = shortName.replace("src/data/egypt-2025", "[DATA]");
            shortName = shortName.replace("static-egypt-2025/faces", "[FACES]");
            shortName = shortName.replace("src/data", "[DATA]");
            shortName = shortName.replace("static", "[STATIC]");
            shortName = shortName.replace("io:", "");

            events.push({
              name: shortName,
              cat: "perf,io",
              ph: "X",
              ts: currentTs,
              dur: durUs,
              pid,
              tid: 3, // Unique Thread for I/O
              args: {},
            });
            currentTs += durUs;
          }
        }
      }

      // Handle "FE > Starting" logs (Begin 'B')
      else if (entry.msg?.startsWith("FE > Starting")) {
        // These denote the start of a frontend initiated traced action
        // We can use them to wrap the backend processing
        const name = entry.msg.replace("FE > Starting ", "");
        events.push({
          name: name,
          cat: "frontend",
          ph: "B", // Begin
          ts: ts,
          pid, // Same logical process for correlation
          tid: 2, // Different logical thread for FE
          id: entry.traceId,
          args: { ...pick(entry, ["url", "method", "body"]) },
        });
      }

      // Handle "FE > Finished" logs (End 'E')
      else if (entry.msg?.startsWith("FE > Finished")) {
        const name = entry.msg.replace("FE > Finished ", "");
        events.push({
          name: name,
          cat: "frontend",
          ph: "E", // End
          ts: ts,
          pid,
          tid: 2,
          id: entry.traceId,
          args: { durationMs: entry.durationMs },
        });
      }

      // Generic Log Messages (Instant 'i')
      else {
        events.push({
          name: entry.msg || entry.message || "Log",
          cat: "log",
          ph: "i",
          ts: ts,
          pid,
          tid,
          // s: "g", // Global scope not in type
          args: {
            level: entry.level,
            ...omit(entry, ["time", "level", "v", "pid", "hostname", "msg", "message"]),
          },
        });
      }
    } catch (_e) {
      // Ignore non-json lines
    }
  }

  // If filtering by ID, try to find time bounds and include some surrounding context?
  // For now, strict filtering is safer to reduce noise.

  await Bun.write(outPath, JSON.stringify(events, null, 2));
  logger.raw(`Trace written to: ${outPath} (${events.length} events)`);
  logger.raw(`Open in browser: https://ui.perfetto.dev/`);
}

function pick(obj: any, keys: string[]) {
  const res: any = {};
  for (const key of keys) {
    if (obj[key] !== undefined) res[key] = obj[key];
  }
  return res;
}

function omit(obj: any, keys: string[]) {
  const res: any = { ...obj };
  for (const key of keys) {
    delete res[key];
  }
  return res;
}

main();
