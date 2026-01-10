import { vi } from "vitest";

/**
 * Browser test setup - minimal mocking for external UI libraries
 *
 * We mock bits-ui and svelte-sonner to avoid SSR/transport issues in browser tests.
 * These are lightweight mocks that allow components to render without errors.
 */

vi.mock("bits-ui", function mockBitsUI() {
  return {
    // Return empty objects - components will fail gracefully if they try to use these
    Dialog: {},
    Switch: {},
    Accordion: {},
    Tabs: {},
    ContextMenu: {},
    Label: {},
    Checkbox: {},
    Separator: {},
    NavigationMenu: {},
    Tooltip: {},
    Toggle: {},
    ToggleGroup: {},
    Collapsible: {},
    Button: {},
    DropdownMenu: {},
    Select: {},
    Popover: {},
    AlertDialog: {},
    ScrollArea: {},
    mergeProps: vi.fn(function merge(...args) {
      return Object.assign({}, ...args);
    }),
  };
});

vi.mock("svelte-sonner", function mockSonner() {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      message: vi.fn(),
    },
    Toaster: {},
  };
});
