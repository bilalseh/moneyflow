import { deleteUser } from 'firebase/auth';

import { clearUserData, deleteProfile } from '@/data/firestore';
import { ApiError, apiRequest } from '@/lib/api';
import { getFirebaseAuth } from '@/lib/firebase';

/**
 * Delete the account and everything in it. The API does it in one step
 * (data, plan, usage, Stripe subscription, auth user). If the API cannot be
 * reached, the browser deletes the user's own documents and auth account
 * directly, which the security rules allow.
 */
export async function deleteAccount(uid: string): Promise<'api' | 'client'> {
  try {
    await apiRequest('/account', { method: 'DELETE' });
    await getFirebaseAuth().signOut();
    return 'api';
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
  }
  await clearUserData(uid);
  await deleteProfile(uid);
  const user = getFirebaseAuth().currentUser;
  if (user) await deleteUser(user);
  return 'client';
}
