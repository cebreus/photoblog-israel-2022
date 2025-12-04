<script lang="ts">
  import type { MenuManifest } from "$lib/types/manifest";
  import { Menu, ChevronRight, Calendar } from "@lucide/svelte";
  import Button, {
    buttonVariants,
  } from "$lib/components/ui/button/button.svelte";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Sidebar from "$lib/components/ui/sidebar";

  export let menuItems: MenuManifest = [];
</script>

<header class="sticky top-0 border-b bg-background text-foreground z-10">
  <div class="container mx-auto py-3 flex items-center gap-4">
    <div class="flex-1 flex items-center gap-8">
      <a href="/" class="text-lg font-semibold uppercase">Izrael 2022</a>
      <!-- <div class="flex items-center gap-1">
        <Button size="sm" variant="ghost" href="/">Vše</Button>
        <Button size="sm" variant="ghost" href="/best-of">Výběr</Button>
      </div> -->
    </div>

    <Sheet.Root>
      <Sheet.Trigger
        class={buttonVariants({
          size: "sm",
          variant: "ghost",
        })}
      >
        <Menu />
      </Sheet.Trigger>

      <Sheet.Content side="right" class="overflow-y-auto">
        <Sheet.Header>
          <Sheet.Title>Menu</Sheet.Title>
        </Sheet.Header>
        <nav class="flex flex-col gap-2 mx-2 pr-2">
          <!-- <Button
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
            </Button> -->

          <Sidebar.Menu>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Dny</Sidebar.GroupLabel>
              {#each menuItems as menuDay (menuDay.id)}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton>
                    {#snippet child({ props })}
                      <a href="#{menuDay.id}" {...props}>
                        <Calendar />
                        {menuDay.label}
                        <ChevronRight class="ml-auto size-4" />
                      </a>
                    {/snippet}
                  </Sidebar.MenuButton>

                  <Sidebar.MenuSub>
                    {#each menuDay.locations as menuLocation (menuLocation.id)}
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#{menuLocation.id}">
                          {menuLocation.label}
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {/each}
                  </Sidebar.MenuSub>
                </Sidebar.MenuItem>
              {/each}
            </Sidebar.Group>
          </Sidebar.Menu>

          <!-- <Sheet.Close
              class={buttonVariants({
                size: 'sm',
                variant: 'outline',
                class: 'mr-auto mt-4',
              })}
            >
              Zavřít
            </Sheet.Close> -->
        </nav>
      </Sheet.Content>
    </Sheet.Root>
  </div>
</header>
