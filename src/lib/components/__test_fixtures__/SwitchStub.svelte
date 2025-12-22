<script>
  let { checked = $bindable(false), onCheckedChange, ...rest } = $props();

  function _handleClick() {
    checked = !checked;
    onCheckedChange?.(checked);
  }
</script>

<button role="switch" aria-checked={checked} onclick={handleClick} {...rest}> </button>
