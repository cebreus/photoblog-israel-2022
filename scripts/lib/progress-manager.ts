import { MultiBar, Presets, SingleBar } from "cli-progress";
import colors from "picocolors";

export class ProgressManager {
  private static instance: ProgressManager;
  private multiBar: MultiBar;
  private activeBars: Set<SingleBar> = new Set();
  private isEnabled = true;

  private constructor() {
    this.multiBar = new MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: "{prefix} [{bar}] {percentage}% | {value}/{total} {suffix}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      stopOnComplete: true,
    }, Presets.shades_classic);
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
    const formattedPrefix = colors.cyan(prefix);

    const bar = this.multiBar.create(total, 0, { 
      prefix: formattedPrefix, 
      suffix: "", 
      ...payload 
    });
    
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
      this.multiBar.log(message + "\n");
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
