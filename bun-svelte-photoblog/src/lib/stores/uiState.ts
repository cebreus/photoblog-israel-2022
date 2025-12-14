import { writable } from "svelte/store";

export const activeTab = writable("agenda");
export const isSidebarOpen = writable(true);
