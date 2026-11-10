import { apiErrorSchema } from '@moneyflow/shared';
import type { z } from 'zod';

import { env } from '@/lib/env';
import { getFirebaseAuth } from '@/lib/firebase';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isQuota(): boolean {
    return this.code === 'quota_exceeded' || this.code === 'rate_limited';
  }

  get isUnavailable(): boolean {
    return this.status === 503;
  }
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  schema?: S;
  signal?: AbortSignal;
}

/**
 * Call the Moneyflow API with the current user's Firebase ID token and
 * validate the JSON response. Errors come back as ApiError with the
 * contract's error code.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, schema, signal }: RequestOptions<S> = {},
): Promise<z.infer<S>> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new ApiError(401, 'unauthenticated', 'Not signed in');
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError(0, 'network', 'Network error');
  }

  if (response.status === 204) return undefined as z.infer<S>;
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, retryAfterSeconds } = parsed.data.error;
      throw new ApiError(response.status, code, message, retryAfterSeconds);
    }
    throw new ApiError(
      response.status,
      'http_error',
      `Request failed with ${String(response.status)}`,
    );
  }
  if (!schema) return json as z.infer<S>;
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    throw new ApiError(502, 'invalid_response', 'Unexpected response from the server');
  return parsed.data;
}
