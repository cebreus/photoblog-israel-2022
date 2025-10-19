<script>
  // Komponenta odpovídající partialu c-jumbo.njk
  // Očekává objekt jumbo ze stránky (viz src/lib/pages.ts)
  export let jumbo =
    /** @type {{ title?: string; html?: { excerpt?: string; content?: string } } | null} */ (
      null
    );
</script>

{#if jumbo}
  <article class="o-main o-main--jumbo">
    <div class="c-jumbo container">
      {#if jumbo.title}
        <h1 class="c-jumbo__title">{@html jumbo.title}</h1>
      {/if}

      {#if jumbo.html?.excerpt}
        <div class="c-jumbo__perex col-12 col-lg-7">
          {@html jumbo.html.excerpt}
        </div>
      {/if}

      {#if jumbo.html?.content}
        <div class="c-jumbo__content col-12 col-lg-7">
          {@html jumbo.html.content}
        </div>
      {/if}
    </div>
  </article>
{/if}
