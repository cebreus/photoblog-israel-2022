type FancyboxOptions = Record<string, unknown>;

// Minimal type definition for the Fancybox static object
type FancyboxStatic = {
  bind: (node: HTMLElement, selector: string, options: Record<string, unknown>) => void;
  destroy: () => void;
};

/**
 * Svelte action to bind Fancybox 6 on the client only.
 * Lazily imports JS + CSS to reduce initial bundle size.
 */
export function useFancybox(
  node: HTMLElement,
  {
    selector = "[data-fancybox]",
    options = {},
  }: { selector?: string; options?: Partial<FancyboxOptions> } = {},
) {
  let destroy: (() => void) | undefined;

  const mount = async () => {
    const [{ Fancybox }] = await Promise.all([
      import("@fancyapps/ui"),
      import("@fancyapps/ui/dist/fancybox/fancybox.css"),
    ]);

    const fancybox = Fancybox as FancyboxStatic;

    fancybox.bind(node, selector, {
      Carousel: {
        Thumbs: {
          showOnStart: false,
        },
      },
      on: {
        ready: (fb: { plugins?: { Thumbs?: { hide?: () => void } } }) =>
          fb?.plugins?.Thumbs?.hide?.(),
      },
      ...options,
    });

    destroy = () => fancybox.destroy();
  };

  // Ensure we only touch DOM in browser
  if (typeof window !== "undefined") {
    void mount();
  }

  return {
    destroy() {
      destroy?.();
    },
  };
}
