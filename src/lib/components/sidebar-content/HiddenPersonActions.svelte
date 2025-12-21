<script lang="ts">
  import Eye from "lucide-svelte/icons/eye";
  import UserMinus from "lucide-svelte/icons/user-minus";

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
    class="h-6 text-[10px] flex-1 px-0"
    onclick={() => onRestore(person.id)}
    data-testid="people-tab-ignored-person-restore-button"
    title="Obnovit"
  >
    <Eye class="w-3.5 h-3.5" />
  </Button>
  <Button
    variant="secondary"
    size="sm"
    class="h-6 text-[10px] flex-1 px-0"
    onclick={() => onMarkAsJunk(person.id)}
    data-testid="people-tab-ignored-person-junk-button"
    title="Není osoba"
  >
    <UserMinus class="w-3.5 h-3.5 text-destructive" />
  </Button>
</div>
