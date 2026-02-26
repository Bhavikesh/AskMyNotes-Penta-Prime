import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI } from '../api/endpoints';

export const useDocuments = () => {
  return useQuery({
    queryKey: ['documents'],
    queryFn: documentsAPI.getAll,
    staleTime: 30000,
    retry: 2,
  });
};

export const useDocument = (docId) => {
  return useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsAPI.getById(docId),
    enabled: !!docId,
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};
