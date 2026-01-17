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
    useUpdatePeopleMutation,
  } from "$lib/api/people/mutations";
  import { useAvatarsQuery } from "$lib/api/people/queries";
  import InlineRename from "$lib/components/ui/InlineRename.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import { createLogger } from "$lib/logger";
  import * as m from "$lib/paraglide/messages";
  import { people } from "$lib/stores/people.svelte";
  import { type ImageEntry, type Person, isImageEntry } from "$lib/types/manifest";
  import { isGloballyVisible } from "$lib/utils/gallery";

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
  const updatePeopleMutation = useUpdatePeopleMutation();

  // Derive availableAvatars from query
  const availableAvatars = $derived(avatarsQuery.data ?? []);

  // Derive isWorking from all mutations
  const isWorking = $derived(
    unmatchMutation.isPending ||
      reassignMutation.isPending ||
      invalidateDetectionMutation.isPending ||
      setAvatarMutation.isPending ||
      updateCategoryMutation.isPending ||
      updatePeopleMutation.isPending,
  );

  const personImages = $derived.by(() => {
    if (!person || !open) return [];
    // Use reactive store instead of static getter
    const days = people.photoDays;
    const images: ImageEntry[] = [];
    for (const day of days) {
      for (const item of day.items) {
        if (isGloballyVisible(item) && isImageEntry(item) && item.people?.includes(person.id)) {
          images.push(item);
        }
      }
    }
    return images;
  });

  const crops = $derived.by(() => {
    const result: {
      id: string;
      src: string;
      original: ImageEntry;
      box?: { x: number; y: number; width: number; height: number };
      index: number;
    }[] = [];

    for (const img of personImages) {
      if (!img.people) continue;

      // Find all occurrences of this person in the image
      img.people.forEach((personId, index) => {
        if (personId === person.id) {
          const box = img.analysis?.faces ? img.analysis.faces[index] : undefined;
          result.push({
            id: img.id,
            // Add index to URL to disambiguate multiple crops of the same person in dev mode backend
            src: `${urlPrefix}/faces/${person.id}/${img.id}.jpg?v=${people.lastUpdateTimestamp}&idx=${index}`,
            original: img,
            box,
            index,
          });
        }
      });
    }
    return result;
  });

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
    const isRemovingAll = imageIds.length >= crops.length;

    try {
      await unmatchMutation.mutateAsync({
        personId: person.id,
        imageIds,
        ignore: shouldHide,
      });

      // Success handling
      await onUpdate?.();
      selectedIds = new Set();
      selectedIds = new Set();
      if (shouldHide) {
        toast.success(m.detection_hidden_success({ count: imageIds.length }));
      } else {
        toast.success(m.detection_unmatch_success({ count: imageIds.length }));
      }

      if (isRemovingAll) {
        open = false;
      }
    } catch (e) {
      // Error handled by mutation
      logger.error({ err: e }, "Failed to unmatch faces");
    }
  }

  async function ignoreDetection(crop: (typeof crops)[0]) {
    if (!crop.box) {
      toast.error(m.detection_detection_error());
      return;
    }

    if (isWorking) return;

    try {
      await invalidateDetectionMutation.mutateAsync({
        personId: person.id,
        imageId: crop.id,
        box: crop.box,
      });
      onUpdate?.();
      toast.success(m.detection_detection_invalidated());
    } catch (e) {
      // Error handled by mutation
      logger.error({ err: e }, "Failed to invalidate detection");
    }
  }

  async function updateCategory(category: "person" | "statue" | "painting") {
    if (isWorking) return;
    try {
      await updateCategoryMutation.mutateAsync({ personId: person.id, category });
      onUpdate?.();
      // Toast is handled by mutation onSuccess
    } catch (e) {
      logger.error({ err: e }, "Failed to update category");
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

    const isRemovingAll = ids.length >= crops.length;

    try {
      await reassignMutation.mutateAsync({
        sourcePersonId: person.id,
        targetPersonId: targetPerson.id,
        imageIds: ids,
      });

      // Success handling
      await onUpdate?.();
      selectedIds = new Set();
      showReassignDialog = false;
      toast.success(m.detection_assignedtoperson({ name: targetPerson.name }));

      if (isRemovingAll) {
        open = false;
      }
    } catch (e) {
      // Error handled by mutation
      logger.error({ err: e }, "Failed to reassign faces");
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
    try {
      const selectedCrops = crops.filter((c) => selectedIds.has(c.id));
      const detections = selectedCrops
        .filter((c) => c.box !== undefined)
        .map((c) => ({
          imageId: c.id,
          box: c.box as { x: number; y: number; width: number; height: number },
        }));

      if (detections.length === 0) return;

      await invalidateDetectionMutation.mutateAsync({
        personId: person.id,
        detections,
      });

      toast.success(m.detection_bulk_detection_invalidated());
      onUpdate?.();
      selectedIds = new Set();
    } catch (e) {
      logger.error({ err: e }, "Bulk ignore failed");
      // Toast is already handled by mutation onError
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

  async function handleRename(newName: string) {
    try {
      await updatePeopleMutation.mutateAsync({
        updates: [{ id: person.id, name: newName }],
      });
      onUpdate?.();
    } catch (e) {
      logger.error({ err: e }, "Failed to rename person");
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
            <Button
              variant="ghost"
              class="group hover:bg-muted ring-offset-background focus-visible:ring-ring flex h-auto items-center gap-1.5 rounded-full p-0 pr-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onclick={() => {
                loadAvatars();
                showAvatarDialog = true;
              }}
              title={m.person_detail_change_avatar()}
              data-testid="person-detail-change-avatar-btn"
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
                  <Image class="size-4 text-white" />
                </div>
              </div>
              <ChevronDown
                class="text-muted-foreground/70 group-hover:text-foreground h-3.5 w-3.5 transition-colors"
              />
            </Button>
          {:else}
            <Button
              variant="ghost"
              class="group hover:bg-muted ring-offset-background focus-visible:ring-ring flex h-auto items-center gap-1.5 rounded-full p-0 pr-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onclick={() => {
                loadAvatars();
                showAvatarDialog = true;
              }}
              title={m.person_detail_set_avatar()}
              data-testid="person-detail-set-avatar-btn"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 transition-colors group-hover:bg-slate-300 dark:bg-slate-800 dark:group-hover:bg-slate-700"
              >
                <User class="text-muted-foreground size-4" />
              </div>
              <ChevronDown
                class="text-muted-foreground/70 group-hover:text-foreground h-3.5 w-3.5 transition-colors"
              />
            </Button>
          {/if}
          <InlineRename
            value={person.name}
            onSave={handleRename}
            isSaving={updatePeopleMutation.isPending}
            testId="person-detail-header-name"
          />

          <span
            class="text-muted-foreground ml-1 text-sm font-normal"
            data-testid="person-detail-header-count"
          >
            ({m.person_detections_count({ count: crops.length })})
          </span>
        </Dialog.Title>
      </div>
      <Dialog.Description class="sr-only">
        {m.person_detail_title()}
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
          {m.person_detail_empty()}
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
            <CheckCheck class="mr-1 h-3.5 w-3.5" />
            {m.person_detail_select_all()}
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
            <User class="mr-2 size-4" />
            {m.person_detail_assign_to()}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onclick={() => unmatchSelected(true)}
            disabled={isWorking}
            class="flex-1"
            data-testid="person-detail-bulk-ignore-btn"
          >
            <EyeOff class="mr-2 size-4" />
            {m.person_detail_hide()}
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
              <Spinner class="mr-2 size-4" />
            {:else}
              <Trash2 class="mr-2 size-4" />
              {m.person_detail_unmatch()}
            {/if}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onclick={clearSelection}
            disabled={isWorking}
            data-testid="person-detail-bulk-clear"
          >
            {m.ui_cancel()}
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
              <MoreHorizontal class="size-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Item
                onclick={() => unmatchSelected(false)}
                data-testid="person-detail-unmatch"
                disabled={isWorking || selectedIds.size === 0}
              >
                <Trash2 class="mr-1 size-3.5" />
                {m.person_detail_unmatch()}
                {m.ui_select_all_days()}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onclick={() => unmatchSelected(true)}
                data-testid="person-detail-hide"
                disabled={isWorking || selectedIds.size === 0}
              >
                <EyeOff class="mr-1 size-3.5" />
                {m.person_detail_hide()}
                {m.ui_select_all_days()}
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              <DropdownMenu.Item
                onclick={ignoreSelectedDetections}
                data-testid="person-detail-bulk-invalid-detections"
                class="text-destructive focus:text-destructive"
                disabled={isWorking || selectedIds.size === 0}
              >
                <UserMinus class="mr-1 size-3.5" />
                {m.person_detail_ignore_confirm_action()}
              </DropdownMenu.Item>

              <DropdownMenu.Separator />
              <DropdownMenu.Label>{m.person_detail_reassign_title()}</DropdownMenu.Label>
              <DropdownMenu.Item
                onclick={() => updateCategory("person")}
                data-testid="person-detail-type-person"
              >
                <User class="mr-1 size-3.5" />
                {m.ui_confirm()}: {m.plural_osoba_one()}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => updateCategory("statue")}
                data-testid="person-detail-type-statue"
              >
                <Landmark class="mr-1 size-3.5" />
                {m.ui_confirm()}: Socha
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => updateCategory("painting")}
                data-testid="person-detail-type-painting"
              >
                <Palette class="mr-1 size-3.5" />
                {m.ui_confirm()}: Malba
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
        {m.person_detail_close()}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Secondary Dialog for Reassignment Selection -->
<Dialog.Root bind:open={showReassignDialog}>
  <Dialog.Content class="max-w-md gap-0 p-0" data-testid="reassign-selection-dialog">
    <Dialog.Header class="border-b px-6 py-4">
      <Dialog.Title>{m.person_detail_reassign_title()}</Dialog.Title>
      <Dialog.Description>{m.person_detail_reassign_desc()}</Dialog.Description>
    </Dialog.Header>

    <div class="bg-muted/20 border-b p-4">
      <div class="relative">
        <Search class="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          bind:value={personSearchQuery}
          placeholder={m.person_detail_search_placeholder()}
          class="pl-9"
          data-testid="reassign-search-input"
        />
      </div>
    </div>

    <div class="max-h-75 overflow-y-auto p-2" data-testid="reassign-person-list">
      {#each filteredPeople as p}
        <Button
          variant="ghost"
          class="hover:bg-accent flex h-auto w-full items-center gap-3 rounded-md p-2 text-left transition-colors"
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
              <User class="text-muted-foreground size-4" />
            </div>
          {/if}
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{p.name}</div>
            <div class="text-muted-foreground text-[10px]">
              {m.person_photos_count({ count: p.faceCount })}
            </div>
          </div>
        </Button>
      {:else}
        <div class="p-8 text-center text-muted-foreground text-sm">
          {m.person_detail_no_results()}
        </div>
      {/each}
    </div>

    <Dialog.Footer class="bg-muted/20 border-t px-6 py-4">
      <Button
        variant="outline"
        onclick={() => (showReassignDialog = false)}
        data-testid="reassign-selection-cancel-btn">{m.ui_cancel()}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
<Dialog.Root bind:open={showAvatarDialog}>
  <Dialog.Content class="max-w-2xl" data-testid="avatar-selection-dialog">
    <Dialog.Header>
      <Dialog.Title>{m.person_detail_avatar_title()}</Dialog.Title>
      <Dialog.Description>{m.person_detail_avatar_desc()}</Dialog.Description>
    </Dialog.Header>

    {#if availableAvatars.length === 0}
      <div class="text-muted-foreground p-8 text-center">{m.person_detail_avatar_empty()}</div>
    {:else}
      <div class="grid max-h-[60vh] grid-cols-4 gap-4 overflow-y-auto p-4">
        {#each availableAvatars as avatar}
          <Button
            variant="ghost"
            class="ring-primary group relative aspect-square h-auto overflow-hidden rounded-lg border p-0 transition-all hover:ring-2"
            onclick={() => setAvatar(avatar)}
            disabled={isWorking}
            data-testid={`avatar-option-${avatar}`}
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
          </Button>
        {/each}
      </div>
    {/if}

    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (showAvatarDialog = false)}
        data-testid="avatar-selection-cancel-btn">{m.ui_cancel()}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Confirmation Dialog for Ignoring Detections -->
<Dialog.Root bind:open={showIgnoreConfirm}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{m.person_detail_ignore_confirm_title()}</Dialog.Title>
      <Dialog.Description>
        {m.person_detail_ignore_confirm_desc({ count: selectedIds.size })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (showIgnoreConfirm = false)}
        data-testid="ignore-detection-cancel-btn">{m.ui_cancel()}</Button
      >
      <Button
        variant="destructive"
        onclick={performIgnoreDetections}
        data-testid="ignore-detection-confirm-btn">{m.person_detail_ignore_confirm_action()}</Button
      >
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
