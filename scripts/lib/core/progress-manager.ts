/**
 * @fileoverview CLI progress bar utilities (multi-bar wrapper).
 *
 * @description
 * Provides multi-bar management and helpers for progress display in long-running scripts.
 */
import { MultiBar, Presets, type SingleBar } from "cli-progress";
import colors from "picocolors";

let multiBar: MultiBar | undefined;

const activeBars = new Set<SingleBar>();

// Removed isEnabled check as it was placeholder logic

export function startMultiBar() {
  if (!multiBar) {
    multiBar = new MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        stopOnComplete: true,
      },
      Presets.shades_classic,
    );
  }
}

export function createBar(
  total: number,
  prefix: string,
  payload: Record<string, any> = {},
): SingleBar {
  startMultiBar();
  // We verified multiBar exists above
  const mb = multiBar as MultiBar;

  const isBoxed = process.env.LOG_STYLE === "boxed";
  const useDouble = !prefix.includes("[manage]");
  const boxBar = isBoxed ? (useDouble ? `${colors.dim("│ │")} ` : `${colors.dim("│")}  `) : "";
  const normalizedPrefix =
    prefix.startsWith("[") && prefix.endsWith("]") ? prefix.slice(1, -1) : prefix;
  const formattedPrefix = `${boxBar}[${colors.cyan(normalizedPrefix)}]`;
  const statsPrefix = isBoxed
    ? useDouble
      ? `${colors.dim("│ │")}     `
      : `${colors.dim("│")}      `
    : "      ";

  const topBar = mb.create(
    total,
    0,
    {
      pfx: formattedPrefix,
      ...payload,
    },
    {
      format: "{pfx} [{bar}] {percentage}%",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    },
  );

  const bottomBar = mb.create(
    total,
    0,
    {
      pfx_stats: statsPrefix,
      suffix: "",
      ...payload,
    },
    {
      format: "{pfx_stats}   {value}/{total} {suffix}",
    },
  );

  // Create a wrapper that conforms to SingleBar's basic interface
  let lastUpdate = 0;
  const THROTTLE_MS = 50;

  function truncateSuffix(payload: any): any {
    if (!payload || !payload.suffix) return payload;
    const MAX_LEN = 60; // Safe limit for suffix
    if (payload.suffix.length > MAX_LEN) {
      return { ...payload, suffix: `${payload.suffix.substring(0, MAX_LEN)}...` };
    }
    return payload;
  }

  const wrapper = {
    update: (current: number, payload?: any) => {
      const now = Date.now();
      const isComplete = current >= total;

      if (isComplete || now - lastUpdate > THROTTLE_MS) {
        lastUpdate = now;
        const safePayload = truncateSuffix(payload);
        topBar.update(current, safePayload);
        bottomBar.update(current, safePayload);
      }
    },
    start: (total: number, startValue: number, payload?: any) => {
      // start() typically RESETS payload if provided, so we must re-inject our prefixes
      lastUpdate = Date.now();
      const safePayload = truncateSuffix(payload);
      topBar.start(total, startValue, { pfx: formattedPrefix, ...safePayload });
      bottomBar.start(total, startValue, { pfx_stats: statsPrefix, ...safePayload });
    },
    increment: (step?: number, payload?: any) => {
      const now = Date.now();
      const safePayload = truncateSuffix(payload);
      // ⚠️ Keep this light throttle: removing it floods TTY and reintroduces flicker/lag in nested bars.
      if (now - lastUpdate > THROTTLE_MS) {
        lastUpdate = now;
        topBar.increment(step, { pfx: formattedPrefix, ...safePayload });
        bottomBar.increment(step, { pfx_stats: statsPrefix, ...safePayload });
      } else {
        // Must increment internal state even if not rendering?
        // Actually for correct percentage tracking we should probably just let it through
        // or accept visual delay. Given safely concerns, we allow increment to pass
        // but rely on throttle in update() mostly.
        // For now, let's just un-throttle increment to be safe as face-clustering uses update().
        topBar.increment(step, { pfx: formattedPrefix, ...safePayload });
        bottomBar.increment(step, { pfx_stats: statsPrefix, ...safePayload });
      }
    },
    stop: () => {
      topBar.stop();
      bottomBar.stop();
    },
    setTotal: (total: number) => {
      topBar.setTotal(total);
      bottomBar.setTotal(total);
    },
    // Keep reference to internal bars for removal
    _topBar: topBar,
    _bottomBar: bottomBar,
  } as unknown as SingleBar;

  activeBars.add(wrapper);
  return wrapper;
}

export function removeBar(bar: SingleBar) {
  const b = bar as any;
  if (multiBar) {
    if (b._topBar && b._bottomBar) {
      multiBar.remove(b._topBar);
      multiBar.remove(b._bottomBar);
    } else {
      multiBar.remove(bar);
    }
  }

  activeBars.delete(bar);
  if (activeBars.size === 0 && multiBar) {
    multiBar.stop();
    multiBar = undefined;
  }
}

export function logProgress(message: string) {
  // If multibar is active, use its log method to print ABOVE the bars
  if (multiBar && activeBars.size > 0) {
    multiBar.log(`${message}\n`);
  } else {
    process.stdout.write(`${message}\n`);
  }
}

export function stopAllBars() {
  if (multiBar) {
    multiBar.stop();
    multiBar = undefined;
  }
  activeBars.clear();
}
