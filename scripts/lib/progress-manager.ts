import { MultiBar, Presets, type SingleBar } from "cli-progress";
import colors from "picocolors";

export class ProgressManager {
  private static instance: ProgressManager;
  private multiBar: MultiBar;
  private activeBars: Set<SingleBar> = new Set();
  private isEnabled = true;

  private constructor() {
    this.multiBar = new MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        stopOnComplete: true,
      },
      Presets.shades_classic,
    );
  }

  public static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  public createBar(total: number, prefix: string, payload: Record<string, any> = {}): SingleBar {
    const isBoxed = process.env.LOG_STYLE === "boxed";
    const useDouble = !prefix.includes("[manage]");
    const boxBar = isBoxed ? (useDouble ? `${colors.dim("│ │")} ` : `${colors.dim("│")}  `) : "";
    const formattedPrefix = `${boxBar}${colors.cyan(prefix)}`;
    const statsPrefix = isBoxed
      ? useDouble
        ? `${colors.dim("│ │")}     `
        : `${colors.dim("│")}      `
      : "      ";

    const topBar = this.multiBar.create(
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

    const bottomBar = this.multiBar.create(
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

    this.activeBars.add(wrapper);
    return wrapper;
  }

  public removeBar(bar: SingleBar) {
    const b = bar as any;
    if (b._topBar && b._bottomBar) {
      this.multiBar.remove(b._topBar);
      this.multiBar.remove(b._bottomBar);
    } else {
      this.multiBar.remove(bar);
    }
    this.activeBars.delete(bar);
  }

  public log(message: string) {
    // If multibar is active, use its log method to print ABOVE the bars
    if (this.activeBars.size > 0) {
      this.multiBar.log(`${message}\n`);
    } else {
      process.stdout.write(`${message}\n`);
    }
  }

  public stopAll() {
    this.multiBar.stop();
    this.activeBars.clear();
  }
}

export const progressManager = ProgressManager.getInstance();
