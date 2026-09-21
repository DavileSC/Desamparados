import { useQuery } from '@tanstack/react-query'

export function useHomeData<T>(key: string, fetcher: () => Promise<T[]>) {
  return useQuery({ queryKey: ['home', key], queryFn: fetcher, retry: false, staleTime: 60_000 })
}
