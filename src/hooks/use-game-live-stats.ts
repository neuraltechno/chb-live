import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useGameLiveStats(gameId: string | undefined) {
  const { data, error, isLoading } = useSWR(
    gameId ? `/api/game/${gameId}/live` : null,
    fetcher,
    {
      // Poll every 5 seconds for live games
      refreshInterval: 5000,
      // Revalidate when window gets focus for better UX
      revalidateOnFocus: true,
      // Keep previous data while fetching new data
      keepPreviousData: true,
      // Always revalidate even if data is cached
      revalidateOnMount: true,
      dedupingInterval: 2000,
      // Ensure polling continues even when the window is in the background
      refreshWhenHidden: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
  };
}
