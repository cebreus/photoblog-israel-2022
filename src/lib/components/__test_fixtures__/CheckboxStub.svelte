<script lang="ts">
  interface Props {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (val: boolean) => void;
    [key: string]: any;
  }

  let { checked = $bindable(false), onCheckedChange, ...rest }: Props = $props();

  function _handleClick() {
    let newVal: boolean;
    if (checked === "indeterminate") newVal = true;
    else newVal = !checked;

    checked = newVal;
    onCheckedChange?.(newVal);
  }
</script>

<button
  role="checkbox"
  aria-checked={checked === "indeterminate" ? "mixed" : checked}
  onclick={handleClick}
  {...rest}
>
</button>
