import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Deep link handler for /event/[id].
 * Redirects to the browse feed which scrolls to the linked flyer.
 */
export default function EventRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      // Navigate to the feed tab with the focus post ID as a param
      router.replace(`/?focus=${id}`);
    }
  }, [id, router]);

  return null;
}
