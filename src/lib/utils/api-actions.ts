import { toast } from "svelte-sonner";
import { invalidateAll } from "$app/navigation";
import { IMAGE_MESSAGES } from "$lib/utils/messages";

export type ImageAction = "delete" | "archive";

interface ImagePayload {
  id: string;
  src: string;
}

interface ActionOptions {
  action: ImageAction;
  images: ImagePayload[];
  onStart?(): void;
  onFinish?(): void;
  onSuccess?(result: unknown): void;
  onError?(error: Error): void;
}

export async function performImageAction(options: ActionOptions): Promise<void> {
  const { action, images, onStart, onFinish, onSuccess, onError } = options;

  if (images.length === 0) return;

  if (onStart) onStart();

  try {
    const isDelete = action === "delete";
    const method = isDelete ? "DELETE" : "POST";
    const body = isDelete ? { ids: images } : { action, ids: images };

    const res = await fetch("/api/images", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Chyba při operaci: ${action}`);
    }

    const result = await res.json();

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(function (e: string) {
        toast.warning(e);
      });
    }

    const completed = isDelete ? result.deleted : result.archived;
    const count = (completed || []).length;

    if (count > 0) {
      const actionPast = isDelete ? "smazáno" : "archivováno";
      toast.success(IMAGE_MESSAGES.actionSuccess(actionPast, count));
    }

    if (onSuccess) onSuccess(result);

    await invalidateAll();
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    toast.error(`Nepodařilo se provést akci ${action}: ${error.message}`);
    if (onError) onError(error);
  } finally {
    if (onFinish) onFinish();
  }
}
