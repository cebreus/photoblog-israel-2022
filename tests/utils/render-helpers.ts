/**
 * @fileoverview Browser Test Render Helpers
 *
 * @description
 * Helper functions for rendering Svelte 5 components in vitest-browser-svelte.
 * Works around TypeScript type mismatches between vitest-browser-svelte
 * and Svelte 5's component type system.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { render as vitestRender } from "vitest-browser-svelte";

/**
 * Type-safe render wrapper for Svelte 5 components in browser tests.
 *
 * This wrapper provides proper typing for components using Svelte 5's
 * $props() syntax while avoiding TypeScript errors from vitest-browser-svelte.
 *
 * @param component - The Svelte component to render
 * @param props - Optional props to pass to the component
 * @returns RenderResult with container and component references
 *
 * @example
 * const { container } = renderComponent(MyComponent, { items: mockItems });
 */
export function renderComponent(component: any, props?: Record<string, any>): any {
  return vitestRender(component, props ? { props } : undefined);
}
