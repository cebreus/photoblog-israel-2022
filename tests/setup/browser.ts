import { vi } from "vitest";

/**
 * Browser test setup - minimal mocking for external UI libraries
 *
 * We mock bits-ui and svelte-sonner to avoid SSR/transport issues in browser tests.
 * These are lightweight mocks that allow components to render without errors.
 */

vi.mock("bits-ui", function mockBitsUI() {
  const Mock = (props: any) => props.children?.();
  const MockWithRoot = {
    Root: Mock,
    Item: Mock,
    Trigger: Mock,
    Content: Mock,
    List: Mock,
  };

  return {
    Dialog: MockWithRoot,
    Switch: Mock,
    Accordion: MockWithRoot,
    Tabs: MockWithRoot,
    ContextMenu: MockWithRoot,
    Label: Mock,
    Checkbox: Mock,
    Separator: Mock,
    NavigationMenu: MockWithRoot,
    Tooltip: MockWithRoot,
    Toggle: Mock,
    ToggleGroup: MockWithRoot,
    Collapsible: MockWithRoot,
    Button: Mock,
    DropdownMenu: MockWithRoot,
    Select: MockWithRoot,
    Popover: MockWithRoot,
    AlertDialog: MockWithRoot,
    ScrollArea: MockWithRoot,
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
