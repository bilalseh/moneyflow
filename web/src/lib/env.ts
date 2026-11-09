import { z } from 'zod';

const boolFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().default(''),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().default(''),
  VITE_FIREBASE_PROJECT_ID: z.string().default(''),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().default(''),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().default(''),
  VITE_FIREBASE_APP_ID: z.string().default(''),
  VITE_USE_EMULATORS: boolFromString,
  VITE_API_BASE_URL: z.string().default('/api'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated build-time environment. Firebase values default to empty strings so
 * the static shell can build and render without a configured project; anything
 * that actually needs Firebase goes through getFirebaseApp(), which fails loudly.
 */
export const env: Env = envSchema.parse(import.meta.env);

export function hasFirebaseConfig(e: Env = env): boolean {
  return e.VITE_FIREBASE_API_KEY !== '' && e.VITE_FIREBASE_PROJECT_ID !== '';
}
