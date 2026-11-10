import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';

import { useAuthStore, type SessionUser } from '@/features/auth/authStore';
import { getFirebaseAuth } from '@/lib/firebase';

function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

/** Keep the auth store in sync with Firebase. Returns the unsubscribe function. */
export function listenToAuth(): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    useAuthStore.getState().setUser(user ? toSessionUser(user) : null);
  });
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

const POPUP_FALLBACK = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]);

export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  try {
    await signInWithPopup(auth, googleProvider());
  } catch (error) {
    if (error instanceof FirebaseError && POPUP_FALLBACK.has(error.code)) {
      await signInWithRedirect(auth, googleProvider());
      return;
    }
    throw error;
  }
}

/** Anonymous session: used by both "Try the demo" and "Start as a guest". */
export async function signInAsGuest(): Promise<string> {
  const credential = await signInAnonymously(getFirebaseAuth());
  return credential.user.uid;
}

/**
 * Upgrade an anonymous session to a Google account, keeping the uid and so
 * every document the guest created.
 */
export async function linkGuestToGoogle(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user?.isAnonymous) return;
  const linked = await linkWithPopup(user, googleProvider());
  useAuthStore.getState().setUser(toSessionUser(linked.user));
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/** True for errors that mean the person closed the popup: not worth an error message. */
export function isUserCancelled(error: unknown): boolean {
  return (
    error instanceof FirebaseError &&
    (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request')
  );
}
