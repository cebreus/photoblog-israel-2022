<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import UserMinus from "@lucide/svelte/icons/user-minus";

  import { Button } from "$lib/components/ui/button";
  import type { Person } from "$lib/types/manifest";

  let {
    person,
    onRestore,
    onMarkAsJunk,
  }: {
    person: Person;
    onRestore: (personId: string) => void;
    onMarkAsJunk: (personId: string) => void;
  } = $props();
</script>

<div class="flex gap-1">
  <Button
    variant="secondary"
    size="sm"
    class="h-6 flex-1 px-0 text-[10px]"
    onclick={() => onRestore(person.id)}
    data-testid="people-tab-hidden-person-restore-button"
    title="Obnovit"
  >
    <Eye class="h-3.5 w-3.5" />
  </Button>
  <Button
    variant="secondary"
    size="sm"
    class="h-6 flex-1 px-0 text-[10px]"
    onclick={() => onMarkAsJunk(person.id)}
    data-testid="people-tab-hidden-person-junk-button"
    title="Ignorovat"
  >
    <UserMinus class="text-destructive h-3.5 w-3.5" />
  </Button>
</div>
