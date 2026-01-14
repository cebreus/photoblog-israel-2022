<script lang="ts">
  import GlobeIcon from "@lucide/svelte/icons/globe";

  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { availableLanguageTags, i18n, languageTag } from "$lib/i18n";
  import * as m from "$lib/paraglide/messages";
  import { cn } from "$lib/utils";

  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  import type { LanguageSwitcherProps } from "./types";

  let { align = "end", variant = "outline", class: className }: LanguageSwitcherProps = $props();

  // Dynamic language definition using localized messages
  const languages = $derived(
    availableLanguageTags.map((tag) => ({
      code: tag,
      label: tag === "cs" ? m.language_name_cs() : m.language_name_en(),
    })),
  );

  // Determine current language from URL immediately (reactive, works on SSR)
  const currentLang = $derived.by(() => {
    const pathname = page.url.pathname;
    for (const tag of availableLanguageTags) {
      if (pathname === `/${tag}` || pathname.startsWith(`/${tag}/`)) {
        return tag;
      }
    }
    return languageTag();
  });

  function getCanonicalPath(path: string) {
    for (const tag of availableLanguageTags) {
      if (path === `/${tag}` || path.startsWith(`/${tag}/`)) {
        let sub = path.substring(tag.length + 1);
        if (!sub.startsWith("/")) sub = `/${sub}`;
        return sub;
      }
    }
    return path;
  }

  function handleLanguageChange(newLang: string) {
    const currentPath = page.url.pathname;
    const canonicalPath = getCanonicalPath(currentPath);
    const targetPath = i18n.resolveRoute(canonicalPath, newLang);

    // Reconstruct full URL with query and hash
    let targetUrl = targetPath;
    if (browser) {
      targetUrl += page.url.search + page.url.hash;
    }

    if (currentPath === targetPath) return;

    goto(targetUrl, { invalidateAll: true });
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
    aria-label={m.language_switcher_label()}
  >
    <GlobeIcon class="size-4" />
    <span class="text-xs font-bold">{currentLang.toUpperCase()}</span>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content {align}>
    <DropdownMenu.RadioGroup value={currentLang} onValueChange={(v) => handleLanguageChange(v)}>
      {#each languages as language (language.code)}
        <DropdownMenu.RadioItem value={language.code}>
          {language.label}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
