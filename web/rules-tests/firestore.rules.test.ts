import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'moneyflow-rules-test';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const validTx = { amount: 1250, currency: 'USD', type: 'expense', date: '2026-11-09' };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('firestore rules', () => {
  it('lets a user write and read their own profile', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}`), { mainCurrency: 'USD' }));
    await assertSucceeds(getDoc(doc(db, `users/${ALICE}`)));
  });

  it('lets a user write nested collections under their own uid', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/transactions/t1`), validTx));
    await assertSucceeds(setDoc(doc(db, `users/${ALICE}/goals/g1`), { name: 'Trip' }));
  });

  it('blocks reading another user profile', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}`), { mainCurrency: 'EUR' });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(getDoc(doc(db, `users/${BOB}`)));
  });

  it('blocks writing into another user subtree', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `users/${BOB}/transactions/t1`), validTx));
  });

  it('rejects transactions with float, negative or missing amounts', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    const path = `users/${ALICE}/transactions/t2`;
    await assertFails(setDoc(doc(db, path), { ...validTx, amount: 12.5 }));
    await assertFails(setDoc(doc(db, path), { ...validTx, amount: -100 }));
    await assertFails(setDoc(doc(db, path), { ...validTx, type: 'transfer' }));
  });

  it('rejects collections outside the known list', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, `users/${ALICE}/anything/x`), { a: 1 }));
  });

  it('lets users read but never write their plan and usage', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `billing/${ALICE}`), { plan: 'free' });
      await setDoc(doc(ctx.firestore(), `usage/${ALICE}`), { day: '2026-11-09', count: 3 });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, `billing/${ALICE}`)));
    await assertSucceeds(getDoc(doc(db, `usage/${ALICE}`)));
    await assertFails(setDoc(doc(db, `billing/${ALICE}`), { plan: 'pro' }));
    await assertFails(setDoc(doc(db, `usage/${ALICE}`), { day: '2026-11-09', count: 0 }));
    await assertFails(getDoc(doc(db, `billing/${BOB}`)));
  });

  it('blocks unauthenticated access entirely', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${ALICE}`)));
    await assertFails(setDoc(doc(db, 'public/anything'), { x: 1 }));
  });
});
