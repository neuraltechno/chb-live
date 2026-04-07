import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useGameLiveStats(gameId: string | undefined) {
  const { data, error, isLoading } = useSWR(
    gameId ? `/api/game/${gameId}/live` : null,
    fetcher,
    {
      // Poll every 30 seconds as per the migration plan
      refreshInterval: 30000,
      // Revalidate when window gets focus for better UX
      revalidateOnFocus: true,
      // Keep previous data while fetching new data
      keepPreviousData: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
  };
}
