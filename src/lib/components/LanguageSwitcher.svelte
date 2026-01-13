<script lang="ts">
  import { availableLanguageTags, i18n, languageTag } from "$lib/i18n";
  import * as m from "$lib/paraglide/messages";

  import { browser } from "$app/environment";
  import { page } from "$app/state";

  function getLocalizedHref(lang: string) {
    // 1. Get canonical path from current translated path
    const canonicalPath = i18n.route(page.url.pathname);
    // 2. Resolve it to the target language
    const localizedPath = i18n.resolveRoute(canonicalPath, lang);

    // Preserve search and hash only in browser context (prerendering forbids accessing search)
    if (browser) {
      return localizedPath + page.url.search + page.url.hash;
    }
    return localizedPath;
  }
</script>

<div
  class="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase select-none"
  data-testid="language-switcher"
>
  {#each availableLanguageTags as lang, i}
    {#if i > 0}
      <span class="opacity-20">/</span>
    {/if}
    <a
      href={getLocalizedHref(lang)}
      hreflang={lang}
      aria-label={lang === "cs" ? m.language_switch_to_cs() : m.language_switch_to_en()}
      class="transition-all duration-300 hover:text-orange-400 {languageTag() === lang
        ? 'text-orange-500'
        : 'text-slate-400 opacity-60 hover:opacity-100'}"
    >
      {lang}
    </a>
  {/each}
</div>
