<script lang="ts">
  import { page } from "$app/stores";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import * as Form from "$lib/components/ui/form";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { toast } from "svelte-sonner";
  import { Pencil, X } from "lucide-svelte";
  import { selection, editMode } from "$lib/stores/editorState";
  import { superForm } from "sveltekit-superforms";

  type DisplayItem = ImageEntry | Separator;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let isOpen = $state(false);

  // Manual initial data (replaces Schema)
  const initialData = {
    title: "",
    author: "",
    city: "",
    caption: "",
    keywords: "",
  };

  // Form setup
  const form = superForm(initialData, {
    SPA: true,
    dataType: "json",
    // No validators - relying on manual optional fields
    onUpdate: async ({ form }) => {
      if (form.valid) {
        await handleSubmit(form.data);
      }
    },
  });

  const { form: formData, enhance } = form;

  // Track whether multiple selected images share a common value
  let commonTitle = $state<string | null>(null);
  let commonAuthor = $state<string | null>(null);
  let commonCity = $state<string | null>(null);
  let commonCaption = $state<string | null>(null);
  let commonKeywords = $state<string | null>(null);

  // Derived state from stores (Centralized logic via urlSync.ts)
  let imageIds = $derived(Array.from($selection));
  let activeEntry = $derived($selection.size > 0);
  let isEditMode = $derived($editMode);

  // Derived file names
  let selectedImages = $derived(
    items.filter(
      (item: DisplayItem) => item.type === "image" && $selection.has(item.id),
    ) as ImageEntry[],
  );

  // Open/Close visibility logic
  $effect(() => {
    if (activeEntry) {
      isOpen = true;
    } else {
      isOpen = false;
    }
  });

  // Data population logic - triggers whenever imageIds changes
  $effect(() => {
    // Reading imageIds ensures reactivity
    if (imageIds.length > 0) {
      populateForm();
    }
  });

  // Note: Manual URL <-> Store sync effects removed in favor of src/lib/stores/url-sync.ts

  function removeImage(id: string) {
    selection.toggle(id);
  }

  function toggleEditMode() {
    if ($editMode) {
      editMode.set(false);
      selection.clear();
    } else {
      editMode.set(true);
    }
  }

  // Simplified findImages
  function findImages(): ImageEntry[] {
    return items.filter(
      (item: DisplayItem) => item.type === "image" && $selection.has(item.id),
    ) as ImageEntry[];
  }

  function populateForm() {
    const images = findImages();
    if (images.length === 0) return;

    const getCommon = (
      getter: (img: ImageEntry) => string | undefined,
    ): string | null => {
      const first = getter(images[0]) || "";
      for (let i = 1; i < images.length; i++) {
        if ((getter(images[i]) || "") !== first) return null;
      }
      return first;
    };

    const commonTitleValue = getCommon((i) => i.title);
    const commonAuthorValue = getCommon((i) => i.author);
    const commonCityValue = getCommon((i) => i.city);
    const commonCaptionValue = getCommon((i) => i.caption);
    const commonKeywordsValue = getCommon((i) => i.keywords?.join(", "));

    $formData.title = commonTitleValue ?? "";
    commonTitle = commonTitleValue;

    $formData.author = commonAuthorValue ?? "";
    commonAuthor = commonAuthorValue;

    $formData.city = commonCityValue ?? "";
    commonCity = commonCityValue;

    $formData.caption = commonCaptionValue ?? "";
    commonCaption = commonCaptionValue;

    $formData.keywords = commonKeywordsValue ?? "";
    commonKeywords = commonKeywordsValue;
  }

  async function handleSubmit(data: typeof initialData) {
    if (imageIds.length === 0) return;

    try {
      const payload = {
        imageIds,
        metadata: {
          title:
            data.title === "" && commonTitle === null ? undefined : data.title,
          author:
            data.author === "" && commonAuthor === null
              ? undefined
              : data.author,
          city: data.city === "" && commonCity === null ? undefined : data.city,
          caption:
            data.caption === "" && commonCaption === null
              ? undefined
              : data.caption,
          keywords:
            data.keywords === "" && commonKeywords === null
              ? undefined
              : data.keywords
                  ?.split(",")
                  .map((k: string) => k.trim())
                  .filter(Boolean),
        },
      };

      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Nepodařilo se aktualizovat metadata",
        );
      }

      toast.success(
        imageIds.length === 1
          ? `Uložen ${imageIds.length} obrázek.`
          : `Uloženo ${imageIds.length} obrázků.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  }
</script>

<div class="flex items-center gap-2">
  <Button
    variant="ghost"
    size="icon"
    onclick={toggleEditMode}
    title="Přepnout režim úprav"
    aria-label="Přepnout režim úprav"
    data-testid="edit-offcanvas-trigger"
  >
    <Pencil strokeWidth={2.5} />
  </Button>

  {#if $selection.size > 0}
    <div class="w-px h-6 bg-slate-700 mx-2"></div>
    <Button variant="ghost" size="sm" onclick={() => selection.clear()}>
      Odebrat ({$selection.size})
    </Button>
    <Button variant="secondary" size="sm" onclick={() => (isOpen = true)}>
      Upravit
    </Button>
  {/if}
</div>

<Offcanvas.Root bind:open={isOpen}>
  <Offcanvas.Content
    side="right"
    className="overflow-y-auto border-l p-6 dark:bg-slate-900"
  >
    <div class="flex flex-col space-y-2 text-center sm:text-left mb-6">
      <h2 class="text-lg font-semibold text-foreground">Upravit metadata</h2>
      <div class="text-sm text-muted-foreground flex flex-col gap-2">
        <span>
          {imageIds.length === 1
            ? `Úprava ${imageIds.length} obrázku:`
            : `Úprava ${imageIds.length} obrázků:`}
        </span>
        <div class="flex flex-wrap gap-1">
          {#if selectedImages.length > 1}
            <Badge
              variant="destructive"
              class="font-mono text-xs cursor-pointer hover:bg-destructive/90"
              onclick={() => selection.clear()}
            >
              Odebrat vše
            </Badge>
          {/if}
          {#each selectedImages as img (img.id)}
            <Badge
              variant="secondary"
              class="font-mono text-xs flex gap-1 items-center pr-1"
            >
              {img.src.split("/").pop()}
              <button
                onclick={() => removeImage(img.id)}
                class="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Odebrat z výběru"
                type="button"
              >
                <X size={12} />
              </button>
            </Badge>
          {/each}
        </div>
      </div>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      method="POST"
      use:enhance
      class="grid gap-4 py-4"
      onkeydown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          form.submit();
        }
      }}
    >
      <Form.Field {form} name="title">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Název</Form.Label>
            <Input {...props} bind:value={$formData.title} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="author">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Autor</Form.Label>
            <Input {...props} bind:value={$formData.author} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="city">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Město</Form.Label>
            <Input {...props} bind:value={$formData.city} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="caption">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Popisek</Form.Label>
            <Textarea {...props} bind:value={$formData.caption} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="keywords">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Klíčová slova</Form.Label>
            <Input {...props} bind:value={$formData.keywords} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6"
      >
        <Button type="submit">Uložit změny</Button>
      </div>
    </form>
  </Offcanvas.Content>
</Offcanvas.Root>
