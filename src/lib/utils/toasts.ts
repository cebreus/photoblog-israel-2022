import { toast } from "svelte-sonner";

type MessageResolver<T> = string | ((data: T) => string);

interface SmartToastOptions<T> {
  loading: string;
  success: MessageResolver<T>;
  error: MessageResolver<unknown>;
  delay?: number;
}

/**
 * Wrapper around a promise that displays a loading toast only if the operation
 * takes longer than the specified delay (default 500ms).
 * Success/Error toasts are always displayed.
 */
export async function smartToast<T>(
  promise: Promise<T>,
  messages: SmartToastOptions<T>,
): Promise<T> {
  const { loading, success, error, delay = 500 } = messages;
  let toastId: string | number | undefined;

  const timer = setTimeout(() => {
    toastId = toast.loading(loading);
  }, delay);

  try {
    const data = await promise;
    clearTimeout(timer);

    const successMsg = typeof success === "function" ? success(data) : success;

    if (toastId) {
      // If loading was shown, update it
      toast.success(successMsg, { id: toastId });
    } else {
      // Otherwise create new success toast
      toast.success(successMsg);
    }

    return data;
  } catch (err) {
    clearTimeout(timer);

    const errorMsg = typeof error === "function" ? error(err) : error;

    if (toastId) {
      toast.error(errorMsg, { id: toastId });
    } else {
      toast.error(errorMsg);
    }

    throw err;
  }
}
