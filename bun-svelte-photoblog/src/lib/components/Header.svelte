<script>
  // @ts-nocheck
  import {
    Menu,
    Home,
    Star,
    FileText,
    ChevronRight,
    Calendar,
  } from '@lucide/svelte';
  import Button, {
    buttonVariants,
  } from '$lib/components/ui/button/button.svelte';

  import * as Sheet from '$lib/components/ui/sheet';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import menu from '$lib/menu.manifest.json';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import slugify from 'slugify';

  function getCzechDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('cs-CZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  import { get } from 'svelte/store';

  const baseNoSlash = base.replace(/\/$/, '');

  function anchorHref(id) {
    // read page synchronously when building href
    const p = get(page);
    const isHome = p.url.pathname.replace(/\/$/, '') === baseNoSlash;
    return isHome ? `#${id}` : `${baseNoSlash}#${id}`;
  }
</script>

<header class="sticky top-0 border-b bg-background text-foreground z-10">
  <div class="container mx-auto py-3 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
      <div class="flex items-center gap-1">
        <Button size="sm" variant="ghost" href="/">Vše</Button>
        <Button size="sm" variant="ghost" href="/best-of">Výběr</Button>
      </div>
    </div>

    <div class="ml-auto">
      <Sheet.Root>
        <Sheet.Trigger
          class={buttonVariants({
            size: 'sm',
            variant: 'icon',
          })}
        >
          <Menu />
        </Sheet.Trigger>

        <Sheet.Content side="right">
          <Sheet.Header>
            <Sheet.Title c>Menu</Sheet.Title>
          </Sheet.Header>
          <nav
            class="flex flex-col gap-2 mx-2 overflow-y-auto max-h-[80vh] pr-2"
          >
            <Button
              variant="ghost"
              size="sm"
              href="/"
              class="w-full justify-start items-center gap-3"
            >
              <Home class="size-4" />
              <span>Vše</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              href="/best-of"
              class="w-full justify-start items-center gap-3"
            >
              <Star class="size-4" />
              <span>Výběr fotek</span>
            </Button>

            <Sidebar.Menu>
              <Sidebar.Group>
                <Sidebar.GroupLabel>Dny</Sidebar.GroupLabel>
                {#each menu as day (day.id)}
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton as="a" href={anchorHref(day.id)}>
                      <Calendar />
                      {day.label}
                      <ChevronRight class="ml-auto size-4" />
                    </Sidebar.MenuButton>

                    <Sidebar.MenuSub
                      open={day.date === $page.url.pathname.split('/')[2] ||
                        $page.url.hash === `#${day.id}`}
                    >
                      {#each day.locations as loc (loc.id)}
                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton href={anchorHref(loc.id)}>
                            {loc.label}
                          </Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      {/each}
                    </Sidebar.MenuSub>
                  </Sidebar.MenuItem>
                {/each}
              </Sidebar.Group>
            </Sidebar.Menu>

            <Sheet.Close
              class={buttonVariants({
                size: 'sm',
                variant: 'outline',
                class: 'mr-auto mt-4',
              })}
            >
              Zavřít
            </Sheet.Close>
          </nav>
        </Sheet.Content>
      </Sheet.Root>
    </div>
  </div>
</header>
