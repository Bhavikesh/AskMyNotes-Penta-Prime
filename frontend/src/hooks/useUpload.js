import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadAPI } from '../api/endpoints';

export const useUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, company }) => uploadAPI.uploadFile(file, company),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};