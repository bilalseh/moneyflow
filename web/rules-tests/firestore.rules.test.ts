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
    await assertSucceeds(
      setDoc(doc(db, `users/${ALICE}/transactions/t1`), { amount: 1250, currency: 'USD' }),
    );
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
    await assertFails(setDoc(doc(db, `users/${BOB}/transactions/t1`), { amount: 1 }));
  });

  it('blocks unauthenticated access entirely', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${ALICE}`)));
    await assertFails(setDoc(doc(db, 'public/anything'), { x: 1 }));
  });
});
