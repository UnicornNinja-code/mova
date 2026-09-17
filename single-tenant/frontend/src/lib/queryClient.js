import { QueryClient } from "@tanstack/react-query";

/**
 * Enterprise QueryClient configured according to MantaKopi optimization rules:
 * - Deduplication of repetitive API requests
 * - Intelligent background caching (5 minutes staleTime)
 * - Safe retry policies (1 retry on error)
 * - Automatic garbage collection (10 minutes gcTime)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh window
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      retry: (failureCount, error) => {
        // Do not retry 401 or 403 or 404 client errors
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default queryClient;
