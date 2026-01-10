<script lang="ts">
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";

  import { browser } from "$app/environment";

  let { children } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: true,
        retry: false,
      },
    },
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children?.()}
</QueryClientProvider>
