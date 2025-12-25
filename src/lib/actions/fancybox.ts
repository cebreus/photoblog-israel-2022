type FancyboxOptions = Record<string, unknown>;

// Minimal type definition for the Fancybox static object
type FancyboxStatic = {
  bind: (container: HTMLElement, selector: string, options: Record<string, unknown>) => void;
  destroy: () => void;
  close: () => void;
  show: (items: unknown[], options?: Record<string, unknown>) => void;
  fromNodes: (nodes: unknown[]) => unknown;
};

/**
 * Svelte action to bind Fancybox 6 on the client only.
 * Lazily imports JS + CSS on the first click of a data-fancybox element.
 */
export function useFancybox(
  node: HTMLElement,
  {
    selector = "[data-fancybox]",
    options = {},
  }: { selector?: string; options?: Partial<FancyboxOptions> } = {},
) {
  let destroy: (() => void) | undefined;
  let fancyboxInstance: FancyboxStatic | undefined;

  async function initAndOpen(trigger: HTMLElement) {
    if (fancyboxInstance) return;

    const [{ Fancybox }] = await Promise.all([
      import("@fancyapps/ui"),
      import("@fancyapps/ui/dist/fancybox/fancybox.css"),
    ]);

    fancyboxInstance = Fancybox as FancyboxStatic;

    // Bind for future clicks
    fancyboxInstance.bind(node, selector, {
      Carousel: {
        Thumbs: {
          showOnStart: false,
        },
      },
      on: {
        ready: function (fb: { plugins?: { Thumbs?: { hide?: () => void } } }) {
          fb?.plugins?.Thumbs?.hide?.();
        },
      },
      ...options,
    });

    destroy = function () {
      fancyboxInstance?.destroy();
    };

    // Trigger the click again? Or manually open?
    // The 'bind' above attaches a click listener.
    // But this 'click' event already happened and we prevented default (likely) or consumed it.
    // We need to tell Fancybox to open *starting at this element*.
    trigger.click();
  }

  function handleClick(e: MouseEvent) {
    const trigger = (e.target as HTMLElement).closest(selector) as HTMLElement;
    if (!trigger) return;

    if (!fancyboxInstance) {
      e.preventDefault();
      e.stopPropagation();
      initAndOpen(trigger);
    }
    // If fancyboxInstance exists, let Fancybox (bound above) handle it
  }

  // Attach our lazy listener with capture to catch it before potential others (if any)
  // or just bubble phase.
  node.addEventListener("click", handleClick);

  return {
    destroy() {
      node.removeEventListener("click", handleClick);
      destroy?.();
    },
  };
}
