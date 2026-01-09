<script lang="ts">
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Image from "@lucide/svelte/icons/image";
  import Landmark from "@lucide/svelte/icons/landmark";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import Palette from "@lucide/svelte/icons/palette";
  import Search from "@lucide/svelte/icons/search";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import User from "@lucide/svelte/icons/user";
  import UserMinus from "@lucide/svelte/icons/user-minus";
  import { toast } from "svelte-sonner";

  import {
    useInvalidateDetectionMutation,
    useReassignFaceMutation,
    useSetAvatarMutation,
    useUnmatchFaceMutation,
    useUpdateCategoryMutation,
  } from "$lib/api/people/mutations";
  import { useAvatarsQuery } from "$lib/api/people/queries";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Spinner } from "$lib/components/ui/spinner";
  import { createLogger } from "$lib/logger";
  import { people } from "$lib/stores/people.svelte";
  import type { ImageEntry, Person } from "$lib/types/manifest";
  import { tracedFetch } from "$lib/utils/api";
  import { DETECTION_MESSAGES, GENERIC_MESSAGES } from "$lib/utils/messages";

  const logger = createLogger("PersonDetailDialog");

  let {
    open = $bindable(false),
    person,
    urlPrefix,
    onUpdate,
  } = $props<{
    open: boolean;
    person: Person;
    urlPrefix: string;
    onUpdate?: () => void;
  }>();

  // TanStack Query hooks
  const unmatchMutation = useUnmatchFaceMutation();
  const reassignMutation = useReassignFaceMutation();
  const invalidateDetectionMutation = useInvalidateDetectionMutation();
  const avatarsQuery = useAvatarsQuery();
  const setAvatarMutation = useSetAvatarMutation();
  const updateCategoryMutation = useUpdateCategoryMutation();

  // Derive availableAvatars from query
  const availableAvatars = $derived(avatarsQuery.data ?? []);

  // Keep isWorking as state for now (functions not yet refactored still use it)
  // TODO: Replace with derived state when all functions use TanStack Query
  let isWorking = $state(false);

  const personImages = $derived.by(() => {
    if (!person || !open) return [];
    // Use reactive store instead of static getter
    const days = people.photoDays;
    const images: ImageEntry[] = [];
    for (const day of days) {
      for (const item of day.items) {
        if (item.type === "image" && item.people?.includes(person.id)) {
          images.push(item as ImageEntry);
        }
      }
    }
    return images;
  });

  const crops = $derived(
    personImages.map((img) => {
      // Find the index of the person in the parallel arrays
      const personIndex = img.people?.indexOf(person.id) ?? -1;
      const box =
        personIndex !== -1 && img.analysis?.faces ? img.analysis.faces[personIndex] : undefined;

      return {
        id: img.id,
        src: `${urlPrefix}/faces/${person.id}/${img.id}.jpg?v=${people.lastUpdateTimestamp}`,
        original: img,
        box,
      };
    }),
  );

  let selectedIds = $state<Set<string>>(new Set());
  let showReassignDialog = $state(false);
  let showAvatarDialog = $state(false);
  let showIgnoreConfirm = $state(false);
  let personSearchQuery = $state("");

  const filteredPeople = $derived.by(() => {
    if (!open) return [];
    return people.peopleWithStats
      .filter((p) => p.id !== person.id && !p.hidden)
      .filter((p) => !p.name.toLowerCase().includes("odpojeno od")) // Exclude "Odpojeno od..." people
      .filter((p) => p.name.toLowerCase().includes(personSearchQuery.toLowerCase()))
      .sort((a, b) => b.faceCount - a.faceCount)
      .slice(0, 20);
  });

  function toggleSelection(imageId: string) {
    if (selectedIds.has(imageId)) {
      selectedIds.delete(imageId);
    } else {
      selectedIds.add(imageId);
    }
    selectedIds = new Set(selectedIds); // Trigger reactivity
  }

  function selectAll() {
    selectedIds = new Set(crops.map((c) => c.id));
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  async function unmatchFace(imageId: string, shouldHide = false) {
    await performUnmatch([imageId], shouldHide);
  }

  async function unmatchSelected(shouldHide = false) {
    const count = selectedIds.size;
    if (count === 0) return;

    await performUnmatch(Array.from(selectedIds), shouldHide);
    selectedIds = new Set();
  }

  async function performUnmatch(imageIds: string[], shouldHide = false) {
    if (isWorking) return;
    isWorking = true;
    const isRemovingAll = imageIds.length >= crops.length;

    try {
      const res = await tracedFetch("/api/people/unmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, imageIds, ignore: shouldHide }),
      });

      if (res.ok) {
        // Wait for data refresh to complete
        await onUpdate?.();

        // Clear selection to show fresh state
        selectedIds = new Set();

        toast.success(DETECTION_MESSAGES.unmatchSuccess(imageIds.length, shouldHide), {
          duration: 5000,
        });

        // Close dialog only if all crops were removed
        if (isRemovingAll) {
          open = false;
        }
      } else {
        const data = await res.json();
        toast.error(GENERIC_MESSAGES.PROCESSING_ERROR, {
          description: data.error || GENERIC_MESSAGES.OPERATION_FAILED,
          duration: 10000,
        });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to unmatch faces");
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR, {
        description: GENERIC_MESSAGES.COMMUNICATION_ERROR_DESCRIPTION,
        duration: 10000,
      });
    } finally {
      isWorking = false;
    }
  }

  async function ignoreDetection(crop: (typeof crops)[0]) {
    if (!crop.box) {
      toast.error(DETECTION_MESSAGES.DETECTION_ERROR);
      return;
    }

    if (isWorking) return;
    isWorking = true;
    try {
      const res = await tracedFetch("/api/people/invalidate-detection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: person.id,
          imageId: crop.id,
          box: crop.box,
        }),
      });

      if (res.ok) {
        onUpdate?.();
        toast.success(DETECTION_MESSAGES.DETECTION_INVALIDATED);
      } else {
        const data = await res.json();
        toast.error(GENERIC_MESSAGES.PROCESSING_ERROR, {
          description: data.error || DETECTION_MESSAGES.SAVE_SETTINGS_FAILED,
        });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to invalidate detection");
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR);
    } finally {
      isWorking = false;
    }
  }

  async function updateCategory(category: "person" | "statue" | "painting") {
    if (isWorking) return;
    isWorking = true;
    try {
      const res = await tracedFetch("/api/people/update-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, category }),
      });

      if (res.ok) {
        onUpdate?.();
        toast.success(DETECTION_MESSAGES.categoryChanged(category));
      } else {
        toast.error(DETECTION_MESSAGES.CATEGORY_CHANGE_FAILED);
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to update category");
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR);
    } finally {
      isWorking = false;
    }
  }

  async function assignToPerson(targetPerson: Person) {
    if (isWorking) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Detect photos where target already exists (both people on same photo)
    const existing = new Set<string>();
    for (const day of people.photoDays) {
      for (const item of day.items) {
        if (item.type === "image" && item.people?.includes(targetPerson.id)) {
          existing.add(item.id);
        }
      }
    }

    const overlapping = ids.filter((id) => existing.has(id));
    const newAssignments = ids.filter((id) => !existing.has(id));

    // If all photos already have target person, just unmatch source person from them
    if (newAssignments.length === 0 && overlapping.length > 0) {
      await performUnmatch(overlapping, false);
      return;
    }

    isWorking = true;
    const isRemovingAll = ids.length >= crops.length;

    try {
      const res = await tracedFetch("/api/people/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePersonId: person.id,
          targetPersonId: targetPerson.id,
          imageIds: ids,
        }),
      });

      if (res.ok) {
        // Wait for data refresh before clearing UI state
        await onUpdate?.();

        // Clear selection to show fresh state
        selectedIds = new Set();
        showReassignDialog = false;

        toast.success(DETECTION_MESSAGES.assignedToPerson(targetPerson.name));

        // Close dialog only if all crops were removed
        if (isRemovingAll) {
          open = false;
        }
      } else {
        const data = await res.json();
        toast.error(DETECTION_MESSAGES.ASSIGNMENT_ERROR, { description: data.error });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to reassign faces");
      toast.error(GENERIC_MESSAGES.COMMUNICATION_ERROR);
    } finally {
      isWorking = false;
    }
  }

  function ignoreSelectedDetections() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    showIgnoreConfirm = true;
  }

  async function performIgnoreDetections() {
    showIgnoreConfirm = false;

    if (isWorking) return;
    isWorking = true;
    try {
      const selectedCrops = crops.filter((c) => selectedIds.has(c.id));
      const results = await Promise.allSettled(
        selectedCrops.map(async (crop) => {
          if (!crop.box) return;
          const res = await tracedFetch("/api/people/invalidate-detection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personId: person.id,
              imageId: crop.id,
              box: crop.box,
            }),
          });
          if (!res.ok) throw new Error(res.statusText);
        }),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const successCount = selectedCrops.length - failed.length;
        if (successCount === 0) throw new Error("Všechny operace selhaly");
        toast.warning(GENERIC_MESSAGES.partialSuccess(successCount, failed.length));
        logger.error({ failed }, "Some bulk ignore operations failed");
      } else {
        toast.success(DETECTION_MESSAGES.BULK_DETECTION_INVALIDATED);
      }

      onUpdate?.();
      selectedIds = new Set();
    } catch (e) {
      logger.error({ err: e }, "Bulk mark-as-junk failed");
      toast.error(DETECTION_MESSAGES.BULK_DETECTION_FAILED);
      toast.error(DETECTION_MESSAGES.BULK_DETECTION_FAILED);
    } finally {
      isWorking = false;
    }
  }

  // No-op function - avatars are now loaded automatically via avatarsQuery
  function loadAvatars() {
    // Avatars are loaded automatically via TanStack Query (avatarsQuery)
  }

  async function setAvatar(avatar: string) {
    if (isWorking) return;
    try {
      await setAvatarMutation.mutateAsync({ personId: person.id, avatarPath: avatar });
      showAvatarDialog = false;
      onUpdate?.();
    } catch (e) {
      // Error already handled by mutation's onError callback
      logger.error({ err: e }, "Failed to set avatar");
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="flex h-[80vh] max-w-5xl min-w-3xl flex-col gap-0 p-0"
    data-testid="person-detail-dialog-content"
  >
    <Dialog.Header class="border-b px-6 py-4" data-testid="person-detail-dialog-header">
      <div class="flex items-center justify-between">
        <Dialog.Title class="flex items-center gap-2" data-testid="person-detail-dialog-title">
          {#if person.thumbnail}
            <button
              class="group hover:bg-muted ring-offset-background focus-visible:ring-ring flex items-center gap-1.5 rounded-full py-0 pr-2 pl-0 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onclick={() => {
                loadAvatars();
                showAvatarDialog = true;
              }}
              title="Změnit avatar"
              type="button"
            >
              <div class="relative h-8 w-8 overflow-hidden rounded-full">
                <img
                  src={`${urlPrefix}/${person.thumbnail}?v=${people.lastUpdateTimestamp}`}
                  class="h-full w-full object-cover"
                  alt={person.name}
                  data-testid="person-detail-header-thumbnail"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Image class="h-4 w-4 text-white" />
                </div>
              </div>
              <ChevronDown
                class="text-muted-foreground/70 group-hover:text-foreground h-3.5 w-3.5 transition-colors"
              />
            </button>
          {:else}
            <button
              class="group hover:bg-muted ring-offset-background focus-visible:ring-ring flex items-center gap-1.5 rounded-full py-0 pr-2 pl-0 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onclick={() => {
                loadAvatars();
                showAvatarDialog = true;
              }}
              title="Nastavit avatar"
              type="button"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 transition-colors group-hover:bg-slate-300 dark:bg-slate-800 dark:group-hover:bg-slate-700"
              >
                <User class="text-muted-foreground h-4 w-4" />
              </div>
              <ChevronDown
                class="text-muted-foreground/70 group-hover:text-foreground h-3.5 w-3.5 transition-colors"
              />
            </button>
          {/if}
          <span data-testid="person-detail-header-name">{person.name}</span>

          <span
            class="text-muted-foreground ml-1 text-sm font-normal"
            data-testid="person-detail-header-count"
          >
            ({crops.length} detekcí)
          </span>
        </Dialog.Title>
      </div>
      <Dialog.Description class="sr-only">
        Detail osoby a všechny detekované tváře
      </Dialog.Description>
    </Dialog.Header>

    <div
      class="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-900/50"
      data-testid="person-detail-dialog-body"
    >
      {#if crops.length === 0}
        <div
          class="text-muted-foreground flex h-full items-center justify-center"
          data-testid="person-detail-empty-state"
        >
          Žádné detekované tváře. (Možná běží clustering nebo refresh dat?)
        </div>
      {:else}
        <!-- Grid layout with Cards (No overlaps) -->
        <div
          class="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3"
          data-testid="person-detail-crop-grid"
        >
          {#each crops as crop}
            {@const isSelected = selectedIds.has(crop.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class={`bg-background relative flex cursor-pointer flex-col overflow-hidden rounded-lg border shadow-sm transition-all ${isSelected ? "border-blue-500 ring-2 ring-blue-500" : "hover:border-primary/50"}`}
              data-testid={`person-detail-crop-item-${crop.id}`}
              onclick={() => toggleSelection(crop.id)}
            >
              <!-- Selection Indicator (Like PhotoGridItem) -->
              <div class="absolute top-2 right-2 z-10" data-testid="person-detail-crop-checkbox">
                <div
                  class={`h-6 w-6 rounded border border-white ${isSelected ? "bg-blue-500" : "bg-black/50"} flex shrink-0 items-center justify-center`}
                  data-testid={`person-detail-crop-checkbox-indicator-${crop.id}`}
                >
                  {#if isSelected}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg
                    >
                  {/if}
                </div>
              </div>

              <!-- Image Area -->
              <div class="group relative aspect-square overflow-hidden">
                <img
                  src={crop.src}
                  alt="Face crop"
                  class={`h-full w-full object-cover transition-opacity ${isSelected ? "opacity-90" : ""}`}
                  loading="lazy"
                  data-testid={`person-detail-crop-image-${crop.id}`}
                />
              </div>

              <!-- Footer Info -->
              <div
                class="bg-muted/10 flex flex-col items-center gap-1 border-t p-2"
                data-testid="person-detail-crop-footer"
              >
                <span
                  class="text-muted-foreground w-full truncate text-center font-mono text-[10px]"
                  title={crop.id}
                  data-testid="person-detail-crop-id"
                >
                  {crop.id}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <Dialog.Footer
      class="bg-muted/20 flex items-center justify-between border-t px-6 py-4"
      data-testid="person-detail-dialog-footer"
    >
      {#if crops.length > 0 && selectedIds.size === 0}
        <div class="mr-auto flex items-center gap-2" data-testid="person-detail-header-actions">
          <Button
            variant="ghost"
            size="sm"
            onclick={selectAll}
            data-testid="person-detail-select-all-btn"
          >
            <CheckCheck class="mr-1 h-3.5 w-3.5" /> Vybrat vše
          </Button>
        </div>
      {:else}
        <div class="mr-auto"></div>
      {/if}

      {#if selectedIds.size > 0}
        <ButtonGroup.Root class="z-10">
          <Button
            variant="outline"
            size="sm"
            disabled
            class="border-r-0"
            data-testid="person-detail-bulk-count"
          >
            {selectedIds.size}
          </Button>

          <ButtonGroup.Separator />

          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              personSearchQuery = "";
              showReassignDialog = true;
            }}
            disabled={isWorking}
            class="flex-1"
            data-testid="person-detail-bulk-assign-btn"
          >
            <User class="mr-2 h-4 w-4" />
            Přiřadit k...
          </Button>

          <Button
            variant="outline"
            size="sm"
            onclick={() => unmatchSelected(true)}
            disabled={isWorking}
            class="flex-1"
            data-testid="person-detail-bulk-ignore-btn"
          >
            <EyeOff class="mr-2 h-4 w-4" />
            Skrýt
          </Button>

          <Button
            variant="outline"
            size="sm"
            onclick={() => unmatchSelected(false)}
            disabled={isWorking}
            class="text-destructive hover:text-destructive hover:bg-destructive/10 flex-1"
            data-testid="person-detail-bulk-unmatch-btn"
          >
            {#if isWorking}
              <Spinner class="mr-2 h-4 w-4" />
            {:else}
              <Trash2 class="mr-2 h-4 w-4" />
              Odepnout
            {/if}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onclick={clearSelection}
            disabled={isWorking}
            data-testid="person-detail-bulk-clear"
          >
            Zrušit
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              class={buttonVariants({
                variant: "outline",
                size: "sm",
              })}
              disabled={isWorking}
              data-testid="person-detail-bulk-more"
            >
              <MoreHorizontal class="h-4 w-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Item
                onclick={() => unmatchSelected(false)}
                data-testid="person-detail-unmatch"
                disabled={isWorking || selectedIds.size === 0}
              >
                <Trash2 class="mr-1 size-3.5" />
                Odepnout vybrané
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onclick={() => unmatchSelected(true)}
                data-testid="person-detail-hide"
                disabled={isWorking || selectedIds.size === 0}
              >
                <EyeOff class="mr-1 size-3.5" />
                Skrýt vybrané
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                onclick={ignoreSelectedDetections}
                data-testid="person-detail-bulk-invalid-detections"
                class="text-destructive focus:text-destructive"
                disabled={isWorking || selectedIds.size === 0}
              >
                <UserMinus class="mr-1 size-3.5" />
                Není tvář, ignorovat
              </DropdownMenu.Item>

              <DropdownMenu.Separator />
              <DropdownMenu.Label>Kategorie osob</DropdownMenu.Label>
              <DropdownMenu.Item
                onclick={() => updateCategory("person")}
                data-testid="person-detail-type-person"
              >
                <User class="mr-1 size-3.5" />
                Nastavit: Osoba
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => updateCategory("statue")}
                data-testid="person-detail-type-statue"
              >
                <Landmark class="mr-1 size-3.5" />
                Nastavit: Socha
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => updateCategory("painting")}
                data-testid="person-detail-type-painting"
              >
                <Palette class="mr-1 size-3.5" />
                Nastavit: Malba
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </ButtonGroup.Root>
      {/if}

      <Button
        variant="outline"
        size="sm"
        onclick={() => (open = false)}
        disabled={isWorking}
        data-testid="person-detail-close-btn"
      >
        Zavřít
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Secondary Dialog for Reassignment Selection -->
<Dialog.Root bind:open={showReassignDialog}>
  <Dialog.Content class="max-w-md gap-0 p-0" data-testid="reassign-selection-dialog">
    <Dialog.Header class="border-b px-6 py-4">
      <Dialog.Title>Přiřadit k osobě</Dialog.Title>
      <Dialog.Description>Vyberte osobu, ke které chcete přiřadit vybrané tváře.</Dialog.Description
      >
    </Dialog.Header>

    <div class="bg-muted/20 border-b p-4">
      <div class="relative">
        <Search class="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
        <input
          bind:value={personSearchQuery}
          placeholder="Hledat osobu..."
          class="bg-background focus:ring-primary/50 w-full rounded-md border py-2 pr-4 pl-9 focus:ring-2 focus:outline-none"
          data-testid="reassign-search-input"
        />
      </div>
    </div>

    <div class="max-h-75 overflow-y-auto p-2" data-testid="reassign-person-list">
      {#each filteredPeople as p}
        <button
          class="hover:bg-accent flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-50"
          onclick={() => assignToPerson(p)}
          disabled={isWorking}
          data-testid={`reassign-person-option-${p.id}`}
        >
          {#if p.thumbnail}
            <img
              src={`${urlPrefix}/${p.thumbnail}?v=${people.lastUpdateTimestamp}`}
              class="h-8 w-8 shrink-0 rounded-full object-cover"
              alt={p.name}
            />
          {:else}
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800"
            >
              <User class="text-muted-foreground h-4 w-4" />
            </div>
          {/if}
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{p.name}</div>
            <div class="text-muted-foreground text-[10px]">{p.faceCount} fotek</div>
          </div>
        </button>
      {:else}
        <div class="p-8 text-center text-muted-foreground text-sm">
          Žádné osoby neodpovídají hledání.
        </div>
      {/each}
    </div>

    <Dialog.Footer class="bg-muted/20 border-t px-6 py-4">
      <Button variant="outline" onclick={() => (showReassignDialog = false)}>Zrušit</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
<Dialog.Root bind:open={showAvatarDialog}>
  <Dialog.Content class="max-w-2xl" data-testid="avatar-selection-dialog">
    <Dialog.Header>
      <Dialog.Title>Vybrat avatar</Dialog.Title>
      <Dialog.Description>Vyberte předpřipravený avatar pro tuto osobu.</Dialog.Description>
    </Dialog.Header>

    {#if availableAvatars.length === 0}
      <div class="text-muted-foreground p-8 text-center">Žádné avatary nenalezeny.</div>
    {:else}
      <div class="grid max-h-[60vh] grid-cols-4 gap-4 overflow-y-auto p-4">
        {#each availableAvatars as avatar}
          <button
            class="ring-primary group relative aspect-square overflow-hidden rounded-lg border transition-all hover:ring-2"
            onclick={() => setAvatar(avatar)}
            disabled={isWorking}
          >
            <img
              src={`${urlPrefix}/${avatar}`}
              class="h-full w-full object-cover"
              alt="avatar"
              loading="lazy"
            />
            <div
              class="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10"
            ></div>
          </button>
        {/each}
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showAvatarDialog = false)}>Zrušit</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Confirmation Dialog for Ignoring Detections -->
<Dialog.Root bind:open={showIgnoreConfirm}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Opravdu zneplatnit detekce?</Dialog.Title>
      <Dialog.Description>
        Tato akce trvale označí vybrané detekce ({selectedIds.size}) jako "neplatné" (není tvář).
        Tváře budou z fotek odstraněny a systém je už nebude znovu detekovat.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showIgnoreConfirm = false)}>Zrušit</Button>
      <Button variant="destructive" onclick={performIgnoreDetections}>Ano, zneplatnit</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
