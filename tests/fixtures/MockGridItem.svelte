<script>
  let { item, onSelect, loading } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-testid="mock-item"
  data-id={item?.id}
  data-loading={loading}
  data-fetchpriority={loading === "eager" ? "high" : undefined}
  onclick={() => onSelect?.(item, false)}
>
  Mock Item
</div>
