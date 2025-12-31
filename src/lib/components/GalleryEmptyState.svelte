<script lang="ts">
  import type { Component } from "svelte";

  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";

  interface Props {
    title: string;
    description: string;
    icon: Component<{ class?: string }>;
    action?: {
      label: string;
      handler: () => void;
    } | null;
  }

  let { title, description, icon: Icon, action }: Props = $props();
</script>

<Empty.Root
  class="mx-auto flex max-w-xl bg-linear-to-br from-slate-100 to-slate-300 p-6 text-center dark:from-slate-700 dark:to-slate-800"
>
  <Empty.Media>
    <Icon class="text-muted-foreground/60 " />
  </Empty.Media>
  <Empty.Header>
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>
      {description}
    </Empty.Description>
  </Empty.Header>
  {#if action}
    <Empty.Content>
      <Button variant="secondary" onclick={action.handler}>
        {action.label}
      </Button>
    </Empty.Content>
  {/if}
</Empty.Root>
