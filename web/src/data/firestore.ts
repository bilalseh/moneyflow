import {
  accountSchema,
  budgetSchema,
  checkinSchema,
  debtSchema,
  fixedCostSchema,
  goalSchema,
  incomeSchema,
  profileSchema,
  recurringRuleSchema,
  scoreSnapshotSchema,
  subscriptionPrefSchema,
  transactionSchema,
  type Profile,
} from '@moneyflow/shared';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { z } from 'zod';

import { getDb } from '@/lib/firebase';

/** Every subcollection under users/{uid}, with the schema its documents follow. */
export const COLLECTIONS = {
  incomes: incomeSchema,
  fixedCosts: fixedCostSchema,
  debts: debtSchema,
  accounts: accountSchema,
  goals: goalSchema,
  transactions: transactionSchema,
  recurring: recurringRuleSchema,
  budgets: budgetSchema,
  scores: scoreSnapshotSchema,
  checkins: checkinSchema,
  subscriptionPrefs: subscriptionPrefSchema,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export type DocOf<C extends CollectionName> = z.infer<(typeof COLLECTIONS)[C]>;

/** Document id used for each collection: most use `id`, month-keyed ones use `month`. */
export function docIdOf<C extends CollectionName>(name: C, value: DocOf<C>): string {
  if (name === 'budgets' || name === 'scores' || name === 'checkins')
    return (value as { month: string }).month;
  if (name === 'subscriptionPrefs') return (value as { key: string }).key;
  return (value as { id: string }).id;
}

/** Firestore rejects `undefined`; strip it so optional fields simply disappear. */
function clean(value: object): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}

export async function readProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  if (!snap.exists()) return null;
  const parsed = profileSchema.safeParse(snap.data());
  return parsed.success ? parsed.data : null;
}

export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'users', uid));
}

export async function writeProfile(uid: string, profile: Profile): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), clean(profileSchema.parse(profile)));
}

/**
 * Read a whole subcollection, validating each document. Invalid documents
 * are skipped (and logged) rather than crashing the screen.
 */
export async function readCollection<C extends CollectionName>(
  uid: string,
  name: C,
): Promise<DocOf<C>[]> {
  const snap = await getDocs(collection(getDb(), 'users', uid, name));
  const schema = COLLECTIONS[name];
  const items: DocOf<C>[] = [];
  for (const d of snap.docs) {
    const parsed = schema.safeParse(d.data());
    if (parsed.success) items.push(parsed.data as DocOf<C>);
    else console.warn(`Skipping invalid ${name}/${d.id}`, parsed.error.issues);
  }
  return items;
}

export async function writeDocument<C extends CollectionName>(
  uid: string,
  name: C,
  value: DocOf<C>,
): Promise<void> {
  const parsed = COLLECTIONS[name].parse(value) as DocOf<C>;
  await setDoc(doc(getDb(), 'users', uid, name, docIdOf(name, parsed)), clean(parsed));
}

export async function deleteDocument(uid: string, name: CollectionName, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'users', uid, name, id));
}

export type WriteOp =
  | { [C in CollectionName]: { kind: 'set'; name: C; value: DocOf<C> } }[CollectionName]
  | { kind: 'delete'; name: CollectionName; id: string }
  | { kind: 'profile'; value: Profile };

/** Commit many writes, chunked under Firestore's 500-operation batch limit. */
export async function commitWrites(uid: string, ops: readonly WriteOp[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      if (op.kind === 'profile')
        batch.set(doc(db, 'users', uid), clean(profileSchema.parse(op.value)));
      else if (op.kind === 'delete') batch.delete(doc(db, 'users', uid, op.name, op.id));
      else {
        const parsed = COLLECTIONS[op.name].parse(op.value);
        batch.set(doc(db, 'users', uid, op.name, docIdOf(op.name, parsed)), clean(parsed));
      }
    }
    await batch.commit();
  }
}

/** Delete every document in the user's subcollections (used to reset the demo). */
export async function clearUserData(uid: string): Promise<void> {
  const ops: WriteOp[] = [];
  for (const name of Object.keys(COLLECTIONS) as CollectionName[]) {
    const snap = await getDocs(collection(getDb(), 'users', uid, name));
    snap.docs.forEach((d) => ops.push({ kind: 'delete', name, id: d.id }));
  }
  await commitWrites(uid, ops);
}
