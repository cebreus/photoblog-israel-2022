import { getContext, setContext } from "svelte";
import { createIsMobile } from "$lib/hooks/is-mobile.svelte.js";
import { SIDEBAR_KEYBOARD_SHORTCUT } from "./constants.js";

type Getter<T> = () => T;

export type SidebarStateProps = {
  /** A getter function that returns the current open state of the sidebar. */
  open: Getter<boolean>;
  /** A function that sets the open state of the sidebar. */
  setOpen: (open: boolean) => void;
};

// Define the shape of the state object for consumers
export type SidebarState = {
  readonly state: "expanded" | "collapsed";
  readonly open: boolean;
  openMobile: boolean;
  readonly isMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  toggle: () => void;
  handleShortcutKeydown: (e: KeyboardEvent) => void;
};

/**
 * Creates the sidebar state definition using Svelte Runes.
 * Manages both desktop and mobile open states.
 */
function createSidebarState(props: SidebarStateProps): SidebarState {
  const isMobile = createIsMobile();
  let openMobile = $state(false);

  const open = $derived.by(() => props.open());
  const state = $derived.by(() => (open ? "expanded" : "collapsed"));

  function setOpenMobile(value: boolean) {
    openMobile = value;
  }

  function toggle() {
    if (isMobile.current) {
      openMobile = !openMobile;
    } else {
      props.setOpen(!open);
    }
  }

  function handleShortcutKeydown(e: KeyboardEvent) {
    if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggle();
    }
  }

  return {
    get state() {
      return state;
    },
    get open() {
      return open;
    },
    get openMobile() {
      return openMobile;
    },
    set openMobile(v) {
      openMobile = v;
    },
    get isMobile() {
      return isMobile.current;
    },
    setOpen: props.setOpen,
    setOpenMobile,
    toggle,
    handleShortcutKeydown,
  };
}

const SYMBOL_KEY = "scn-sidebar";

export function setSidebar(props: SidebarStateProps): SidebarState {
  return setContext(Symbol.for(SYMBOL_KEY), createSidebarState(props));
}

export function useSidebar(): SidebarState {
  return getContext(Symbol.for(SYMBOL_KEY));
}
