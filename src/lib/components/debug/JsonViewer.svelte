<script lang="ts">
  import JsonViewer from "./JsonViewer.svelte";
  import type { JsonValue } from "./types";

  interface Props {
    data: JsonValue;
    level?: number;
    defaultExpanded?: boolean;
  }

  let { data, level = 0, defaultExpanded = false }: Props = $props();

  const initialExpanded = $derived(level === 0 || defaultExpanded);
  let userOverride = $state<boolean | null>(null);
  const isExpanded = $derived(userOverride ?? initialExpanded);

  const isObject = (value: JsonValue): value is { [key: string]: JsonValue } =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = (value: JsonValue): value is JsonValue[] => Array.isArray(value);

  function toggle() {
    userOverride = !isExpanded;
  }
</script>

<div
  class="font-mono text-xs text-gray-200"
  style:--level={level}
  style:padding-left="calc(var(--level) * 0.5rem)"
  data-testid="json-viewer"
>
  >
  {#if isObject(data)}
    <button onclick={toggle} class="cursor-pointer text-gray-400 hover:text-gray-100">
      <span>{isExpanded ? "▼" : "▶"}</span>
    </button>
    <span class="text-white">{isExpanded ? "{" : "{...}"}</span>
    {#if isExpanded}
      <div class="pl-2 border-l border-gray-700">
        {#each Object.entries(data) as [key, value]}
          <div class="flex">
            <span class="text-pink-400">"{key}":</span>
            <JsonViewer data={value} level={level + 1} defaultExpanded={false} />
          </div>
        {/each}
      </div>
      <span class="text-white">}</span>
    {/if}
  {:else if isArray(data)}
    <button onclick={toggle} class="cursor-pointer text-gray-400 hover:text-gray-100">
      <span>{isExpanded ? "▼" : "▶"}</span>
    </button>
    <span class="text-white"
      >{isExpanded ? "[" : "[...]"}{!isExpanded && data.length > 0
        ? ` (${data.length} items)`
        : ""}</span
    >
    {#if isExpanded}
      <div class="pl-2 border-l border-gray-700">
        {#each data as value, i}
          <div class="flex">
            <span class="text-gray-500">{i}:</span>
            <JsonViewer data={value} level={level + 1} defaultExpanded={false} />
          </div>
        {/each}
      </div>
      <span class="text-white">]</span>
    {/if}
  {:else if typeof data === "string"}
    <span class="text-green-400 break-all">"{data}"</span>
  {:else if typeof data === "number"}
    <span class="text-blue-400">{data}</span>
  {:else if typeof data === "boolean"}
    <span class="text-purple-400">{String(data)}</span>
  {:else if data === null}
    <span class="text-gray-500">null</span>
  {/if}
</div>
