/// <reference types="svelte" />

declare global {
  // Ensure svelte templates accept standard HTML attributes when using TypeScript
  namespace svelteHTML {
    interface HTMLAttributes<T> extends svelte.JSX.HTMLAttributes<T> { }
  }
}

export { };
