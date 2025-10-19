<script>
  // @ts-nocheck
  import { Menu, Home, Star, FileText } from '@lucide/svelte';
  import Button, {
    buttonVariants,
  } from '$lib/components/ui/button/button.svelte';

  import * as Sheet from '$lib/components/ui/sheet';
</script>

<header class="border-b bg-background text-foreground">
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
          <nav class=" mx-2 flex flex-col gap-2 mx-2">
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

            <Button
              variant="ghost"
              size="sm"
              href="/changelog/"
              class="w-full justify-start items-center gap-3"
            >
              <FileText class="size-4" />
              <span>Change log</span>
            </Button>

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
