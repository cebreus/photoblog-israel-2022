<script lang="ts">
  import { page } from "$app/stores";
  import * as Offcanvas from "$lib/components/offcanvas";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import * as Form from "$lib/components/ui/form";
  import { Label } from "$lib/components/ui/label";
  import type { ImageEntry, Separator } from "$lib/types/manifest";
  import { toast } from "svelte-sonner";
  import { Pencil, X } from "lucide-svelte";
  import { selection, editMode } from "$lib/stores/editorState";
  import { superForm } from "sveltekit-superforms";
  // Removed Zod due to runtime version conflict causing 500 errors

  type DisplayItem = ImageEntry | Separator;

  let { items = [] } = $props<{ items: DisplayItem[] }>();

  let isOpen = $state(false);

  // Manual initial data (replaces Schema)
  const initialData = {
    title: "",
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

  // Placeholders
  let placeholders = $state({
    title: "",
    city: "",
    caption: "",
    keywords: "",
  });

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

    const commonTitle = getCommon((i) => i.title);
    const commonCity = getCommon((i) => i.city);
    const commonCaption = getCommon((i) => i.caption);
    const commonKeywords = getCommon((i) => i.keywords?.join(", "));

    $formData.title = commonTitle ?? "";
    placeholders.title =
      commonTitle === null ? "Mixed values" : "Title / Object Name";

    $formData.city = commonCity ?? "";
    placeholders.city = commonCity === null ? "Mixed values" : "City";

    $formData.caption = commonCaption ?? "";
    placeholders.caption = commonCaption === null ? "Mixed values" : "Caption";

    $formData.keywords = commonKeywords ?? "";
    placeholders.keywords =
      commonKeywords === null ? "Mixed values" : "Keywords (comma separated)";
  }

  async function handleSubmit(data: typeof initialData) {
    if (imageIds.length === 0) return;

    try {
      const payload = {
        imageIds,
        metadata: {
          title:
            data.title === "" && placeholders.title === "Mixed values"
              ? undefined
              : data.title,
          city:
            data.city === "" && placeholders.city === "Mixed values"
              ? undefined
              : data.city,
          caption:
            data.caption === "" && placeholders.caption === "Mixed values"
              ? undefined
              : data.caption,
          keywords:
            data.keywords === "" && placeholders.keywords === "Mixed values"
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
        throw new Error(errorData.message || "Failed to update metadata");
      }

      toast.success(`Saved ${imageIds.length} images.`);
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
    class={isEditMode ? "text-orange-500 hover:text-orange-600" : ""}
    title="Toggle Edit Mode"
  >
    <Pencil size={20} />
  </Button>

  {#if $selection.size > 0}
    <div class="w-px h-6 bg-slate-700 mx-2"></div>
    <Button
      variant="ghost"
      size="sm"
      onclick={() => selection.clear()}
      class="text-slate-300 hover:text-white"
    >
      Clear ({$selection.size})
    </Button>
    <Button variant="secondary" size="sm" onclick={() => (isOpen = true)}
      >Edit</Button
    >
  {/if}
</div>

<Offcanvas.Root bind:open={isOpen}>
  <Offcanvas.Content
    side="right"
    className="w-[400px] sm:w-[540px] overflow-y-auto border-l p-6"
  >
    <div class="flex flex-col space-y-2 text-center sm:text-left mb-6">
      <h2 class="text-lg font-semibold text-foreground">Edit Metadata</h2>
      <div class="text-sm text-muted-foreground flex flex-col gap-2">
        <span
          >Editing {imageIds.length} image{imageIds.length === 1
            ? ""
            : "s"}:</span
        >
        <div class="flex flex-wrap gap-1">
          {#each selectedImages as img (img.id)}
            <Badge
              variant="secondary"
              class="font-mono text-xs flex gap-1 items-center pr-1"
            >
              {img.src.split("/").pop()}
              <button
                onclick={() => removeImage(img.id)}
                class="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Remove from selection"
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
            <Form.Label>Title</Form.Label>
            <Input
              {...props}
              bind:value={$formData.title}
              placeholder={placeholders.title}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="city">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>City</Form.Label>
            <Input
              {...props}
              bind:value={$formData.city}
              placeholder={placeholders.city}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="caption">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Caption</Form.Label>
            <textarea
              {...props}
              bind:value={$formData.caption}
              placeholder={placeholders.caption}
              class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            ></textarea>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <Form.Field {form} name="keywords">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Keywords</Form.Label>
            <Input
              {...props}
              bind:value={$formData.keywords}
              placeholder={placeholders.keywords}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <div
        class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6"
      >
        <Button type="submit">Save changes</Button>
      </div>
    </form>
  </Offcanvas.Content>
</Offcanvas.Root>
