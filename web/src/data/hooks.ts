import type { Profile } from '@moneyflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  commitWrites,
  deleteDocument,
  readCollection,
  readProfile,
  writeDocument,
  writeProfile,
  type CollectionName,
  type DocOf,
  type WriteOp,
} from '@/data/firestore';
import { useSessionUser } from '@/features/auth/authStore';

export const queryKeys = {
  profile: (uid: string) => ['users', uid, 'profile'] as const,
  collection: (uid: string, name: CollectionName) => ['users', uid, name] as const,
  user: (uid: string) => ['users', uid] as const,
  me: (uid: string) => ['api', uid, 'me'] as const,
};

export function useProfile() {
  const { uid } = useSessionUser();
  return useQuery({ queryKey: queryKeys.profile(uid), queryFn: () => readProfile(uid) });
}

export function useCollection<C extends CollectionName>(name: C) {
  const { uid } = useSessionUser();
  return useQuery({
    queryKey: queryKeys.collection(uid, name),
    queryFn: () => readCollection(uid, name),
  });
}

export function useSaveProfile() {
  const { uid } = useSessionUser();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) => writeProfile(uid, profile),
    onSuccess: (_, profile) => {
      client.setQueryData(queryKeys.profile(uid), profile);
    },
  });
}

/** Save one document and optimistically update the cached collection. */
export function useSaveDoc<C extends CollectionName>(name: C, idOf: (v: DocOf<C>) => string) {
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const key = queryKeys.collection(uid, name);
  return useMutation({
    mutationFn: (value: DocOf<C>) => writeDocument(uid, name, value),
    onMutate: async (value) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<DocOf<C>[]>(key);
      client.setQueryData<DocOf<C>[]>(key, (items = []) => {
        const id = idOf(value);
        const rest = items.filter((i) => idOf(i) !== id);
        return [...rest, value];
      });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteDoc(name: CollectionName) {
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const key = queryKeys.collection(uid, name);
  return useMutation({
    mutationFn: (id: string) => deleteDocument(uid, name, id),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Batch write across collections, then refresh everything for the user. */
export function useCommitWrites() {
  const { uid } = useSessionUser();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ops: WriteOp[]) => commitWrites(uid, ops),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.user(uid) }),
  });
}
