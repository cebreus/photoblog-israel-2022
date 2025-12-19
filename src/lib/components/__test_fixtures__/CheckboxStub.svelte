<script>
  let { checked = $bindable(false), onCheckedChange, ...rest } = $props();

  function handleClick() {
    let newVal;
    if (checked === "indeterminate") newVal = true;
    else newVal = !checked;

    checked = newVal;
    onCheckedChange?.(newVal);
  }
</script>

<button role="checkbox" aria-checked={checked} onclick={handleClick} {...rest}> </button>
