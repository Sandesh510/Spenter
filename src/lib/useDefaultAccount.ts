import { useApi } from './useApi';
import type { Profile } from './types';

/** The user's default account id, read from the cached profile. Null until set. */
export function useDefaultAccountId(token: string): string | null {
  return useApi<Profile>('profile', token).data?.defaultAccountId ?? null;
}
