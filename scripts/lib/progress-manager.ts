import { MultiBar, Presets, type SingleBar } from "cli-progress";
import colors from "picocolors";

const multiBar = new MultiBar(
  {
    clearOnComplete: false,
    hideCursor: true,
    stopOnComplete: true,
  },
  Presets.shades_classic,
);

const activeBars = new Set<SingleBar>();

// Removed isEnabled check as it was placeholder logic

export function createBar(
  total: number,
  prefix: string,
  payload: Record<string, any> = {},
): SingleBar {
  const isBoxed = process.env.LOG_STYLE === "boxed";
  const useDouble = !prefix.includes("[manage]");
  const boxBar = isBoxed ? (useDouble ? `${colors.dim("│ │")} ` : `${colors.dim("│")}  `) : "";
  const formattedPrefix = `${boxBar}${colors.cyan(prefix)}`;
  const statsPrefix = isBoxed
    ? useDouble
      ? `${colors.dim("│ │")}     `
      : `${colors.dim("│")}      `
    : "      ";

  const topBar = multiBar.create(
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

  const bottomBar = multiBar.create(
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
  const wrapper = {
    update: (current: number | any, payload?: any) => {
      topBar.update(current, payload);
      bottomBar.update(current, payload);
    },
    start: (total: number, startValue: number, payload?: any) => {
      topBar.start(total, startValue, payload);
      bottomBar.start(total, startValue, payload);
    },
    increment: (step?: number, payload?: any) => {
      topBar.increment(step, payload);
      bottomBar.increment(step, payload);
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
  if (b._topBar && b._bottomBar) {
    multiBar.remove(b._topBar);
    multiBar.remove(b._bottomBar);
  } else {
    multiBar.remove(bar);
  }
  activeBars.delete(bar);
}

export function logProgress(message: string) {
  // If multibar is active, use its log method to print ABOVE the bars
  if (activeBars.size > 0) {
    multiBar.log(`${message}\n`);
  } else {
    process.stdout.write(`${message}\n`);
  }
}

export function stopAllBars() {
  multiBar.stop();
  activeBars.clear();
}
