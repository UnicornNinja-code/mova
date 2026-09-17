import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogService } from "@/services/catalogService";
import { catalogKeys } from "@/lib/queryKeys";

export function useProductsList(params = {}, options = {}) {
  return useQuery({
    queryKey: catalogKeys.products(),
    queryFn: () => catalogService.getProducts(params),
    ...options,
  });
}

export function useProductDetail(id, options = {}) {
  return useQuery({
    queryKey: catalogKeys.product(id),
    queryFn: () => catalogService.getProductById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => catalogService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => catalogService.updateProduct(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      queryClient.invalidateQueries({ queryKey: catalogKeys.product(id) });
    },
  });
}

export function useToggleProductStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => catalogService.toggleProductStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      queryClient.invalidateQueries({ queryKey: catalogKeys.product(id) });
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => catalogService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}
