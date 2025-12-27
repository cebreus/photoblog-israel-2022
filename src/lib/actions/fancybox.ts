type FancyboxOptions = Record<string, unknown>;

// Minimal type definition for the Fancybox static object
type FancyboxStatic = {
  bind: (container: HTMLElement, selector: string, options: Record<string, unknown>) => () => void;
  destroy: () => void;
  close: () => void;
  show: (items: unknown[], options?: Record<string, unknown>) => void;
  fromNodes: (nodes: unknown[]) => unknown;
};

const DEFAULT_OPTIONS = {
  Carousel: {
    Thumbs: {
      showOnStart: false,
    },
  },
};

/**
 * Svelte action to bind Fancybox on the client only.
 * Initializes and binds to the node on mount.
 */
export function useFancybox(
  node: HTMLElement,
  {
    selector = "[data-fancybox]",
    options = {},
  }: { selector?: string; options?: Partial<FancyboxOptions> } = {},
) {
  let unbind: (() => void) | undefined;
  let fancyboxInstance: FancyboxStatic | undefined;

  async function init() {
    if (typeof window === "undefined") return;

    const { Fancybox } = await import("@fancyapps/ui");
    await import("@fancyapps/ui/dist/fancybox/fancybox.css");

    fancyboxInstance = Fancybox as unknown as FancyboxStatic;

    // Bind Fancybox to the node using the selector
    // This allows event delegation across all items in the container
    unbind = fancyboxInstance.bind(node, selector, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
    node.setAttribute("data-fancybox-initialized", "true");
  }

  init();

  return {
    destroy() {
      unbind?.();
    },
  };
}
