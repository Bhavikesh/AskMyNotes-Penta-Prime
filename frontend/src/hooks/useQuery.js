import { useMutation } from '@tanstack/react-query';
import { queryAPI } from '../api/endpoints';

export const useQueryRun = () => {
  return useMutation({
    mutationFn: queryAPI.processQuery,
  });
};