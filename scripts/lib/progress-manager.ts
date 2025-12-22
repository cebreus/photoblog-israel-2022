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
        format: "{pfx} [{bar}] {percentage}% | {value}/{total} {suffix}",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
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
    if (!this.isEnabled) {
      // Return a dummy object if disabled (though we plan to keep it enabled mostly)
      // For now, we return a functional bar but might want to handle "quiet" mode here if needed globally
    }

    // Ensure prefix is colored or formatted if needed
    const isBoxed = process.env.LOG_STYLE === "boxed";
    // Progress bars are usually from sub-processes, so we use double bar by default
    // unless the prefix explicitly starts with [manage]
    const useDouble = !prefix.includes("[manage]");
    const boxBar = isBoxed ? (useDouble ? `${colors.dim("│ │")} ` : `${colors.dim("│")}  `) : "";
    const formattedPrefix = `${boxBar}${colors.cyan(prefix)}`;

    const bar = this.multiBar.create(total, 0, {
      pfx: formattedPrefix,
      suffix: "",
      ...payload,
    });

    // Wrap update method to preserve pfx in payload
    const originalUpdate = bar.update.bind(bar);
    bar.update = (arg1: number | Record<string, any>, arg2?: Record<string, any>) => {
      if (typeof arg1 === "object") {
        originalUpdate({ pfx: formattedPrefix, ...arg1 });
      } else {
        originalUpdate(arg1, { pfx: formattedPrefix, ...(arg2 || {}) });
      }
    };

    // Wrap start method to preserve pfx in payload
    const originalStart = bar.start.bind(bar);
    bar.start = (total: number, startValue: number, payload?: Record<string, any>) => {
      originalStart(total, startValue, { pfx: formattedPrefix, ...payload });
    };

    this.activeBars.add(bar);
    return bar;
  }

  public removeBar(bar: SingleBar) {
    this.multiBar.remove(bar);
    this.activeBars.delete(bar);
  }

  public log(message: string) {
    // If multibar is active, use its log method to print ABOVE the bars
    if (this.activeBars.size > 0) {
      this.multiBar.log(`${message}\n`);
    } else {
      console.log(message);
    }
  }

  public stopAll() {
    this.multiBar.stop();
    this.activeBars.clear();
  }
}

export const progressManager = ProgressManager.getInstance();
