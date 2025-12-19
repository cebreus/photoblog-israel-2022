<script>
  let { children, ...rest } = $props();
</script>

<div {...rest}>
  {@render children?.({ props: {} })}
</div>
