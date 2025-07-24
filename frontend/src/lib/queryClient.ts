import { QueryClient, QueryFunction } from "@tanstack/react-query";

// In development, we use relative paths so that the Vite proxy handles requests.
// In production, the full API URL is used from environment variables.
const API_BASE_URL = import.meta.env.PROD ? import.meta.env.VITE_API_BASE_URL || '' : '';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Construct the full URL. In dev, this will be a relative path like /api/user.
  // In prod, it will be an absolute path like https://api.example.com/api/user.
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Otimizações para performance mobile
      staleTime: 5 * 60 * 1000, // 5 minutos - dados frescos por mais tempo
      gcTime: 10 * 60 * 1000, // 10 minutos - mantém em cache por mais tempo
      refetchInterval: false, // Desabilita polling automático
      refetchOnWindowFocus: false, // Desabilita refetch no focus
      refetchOnMount: false, // Desabilita refetch no mount
      refetchOnReconnect: true, // Apenas refetch quando reconecta
      retry: (failureCount, error) => {
        // Não retry em erros 4xx
        if (error.message.includes('4')) return false;
        // Retry até 3 vezes para erros de rede
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});

// Helper functions for common cache invalidations
export const invalidatePalletQueries = async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['/api/pallets'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/pallets/available-for-ucp'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }),
  ]);
};

export const refetchPalletQueries = async () => {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['/api/pallets'] }),
    queryClient.refetchQueries({ queryKey: ['/api/pallets/available-for-ucp'] }),
  ]);
};