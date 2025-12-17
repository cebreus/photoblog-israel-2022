import { vi } from "vitest";
import Stub from "../fixtures/Stub.svelte";

// Mock bits-ui globally to avoid transport errors in browser tests
// bits-ui barrel imports cause SSR module evaluation issues in Vitest browser mode

// Create a stub namespace with common component parts
// All components use Stub.svelte which renders children properly
const createComponentNamespace = () => ({
  Root: Stub,
  Trigger: Stub,
  Content: Stub,
  Item: Stub,
  Group: Stub,
  Label: Stub,
  Description: Stub,
  Title: Stub,
  Close: Stub,
  Overlay: Stub,
  Portal: Stub,
  Input: Stub,
  Thumb: Stub,
  // Add more as needed
});

vi.mock("bits-ui", () => ({
  // Component namespaces
  Dialog: createComponentNamespace(),
  Switch: createComponentNamespace(),
  Accordion: createComponentNamespace(),
  Tabs: createComponentNamespace(),
  ContextMenu: createComponentNamespace(),
  Label: createComponentNamespace(),
  Checkbox: createComponentNamespace(),
  Separator: createComponentNamespace(),
  NavigationMenu: createComponentNamespace(),
  Tooltip: createComponentNamespace(),
  Toggle: createComponentNamespace(),
  ToggleGroup: createComponentNamespace(),
  Collapsible: createComponentNamespace(),
  Button: createComponentNamespace(),
  // Utilities
  mergeProps: vi.fn((...args) => Object.assign({}, ...args)),
}));
