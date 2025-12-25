<script lang="ts">
  import { onMount } from "svelte";

  import { useScrollspy } from "$lib/actions/scrollspy";
  import { ui } from "$lib/stores/ui.svelte";

  onMount(() => {
    // Ensure clean state at start of test
    ui.clearSections();
  });
</script>

<div style="padding-bottom: 3000px; height: 8000px;">
  <!-- Huge spacer to ensure section-1 is definitely off screen initially -->
  <div style="height: 2000px; background: #eee;" data-testid="spacer-top">Spacer Top (2000px)</div>

  <div
    use:useScrollspy={{ id: "section-1" }}
    id="section-1"
    style="height: 500px; background: red; margin-bottom: 200px;"
    data-testid="section-1"
  >
    Section 1
  </div>

  <div
    use:useScrollspy={{ id: "section-2" }}
    id="section-2"
    style="height: 500px; background: blue;"
    data-testid="section-2"
  >
    Section 2
  </div>
</div>

<div
  data-testid="active-sections"
  style="position: fixed; top: 0; left: 0; background: white; z-index: 9999;"
>
  {Array.from(ui.activeSections).sort().join(",")}
</div>
