# API contract

The single source of truth for the HTTP boundary between `web/` and `api/`.
TypeScript mirrors it with Zod in `shared/src/api/`, Python with Pydantic in
`api/src/moneyflow_api/schemas/`. Change both sides together.

## Conventions

- Base path `/api`. JSON in and out, UTF-8.
- Every route except `GET /api/health` and `POST /api/billing/webhook`
  requires `Authorization: Bearer <Firebase ID token>`. Anonymous Firebase
  users are allowed.
- Money is always an **integer in minor units** of the given currency.
  The one exception is a coach tool argument named `amountMajor`, which is the
  number the user typed; code converts it.
- `locale` is `"en"` or `"ar"`. AI text is written in that language.
- `currency` is one of `USD EUR GBP LBP AED SAR JOD KWD EGP TRY CAD AUD`.
- Month keys are `YYYY-MM`, dates are `YYYY-MM-DD`.
- `categoryId` is one of: `housing utilities groceries transport health
insurance education debt dining shopping entertainment travel subscriptions
personal gifts savings income other`.
- Every AI response carries `source`: `"ai"` when Gemini produced it and it
  passed validation, `"fallback"` when deterministic server text was used.

### Errors

```json
{ "error": { "code": "quota_exceeded", "message": "Human readable", "retryAfterSeconds": 3600 } }
```

| HTTP | code                     | When                                                         |
| ---- | ------------------------ | ------------------------------------------------------------ |
| 401  | `unauthenticated`        | Missing, malformed, expired or wrong-project token           |
| 404  | `not_found`              | Unknown resource                                             |
| 422  | `invalid_request`        | Body fails validation                                        |
| 429  | `quota_exceeded`         | Daily AI quota used up (`retryAfterSeconds` to UTC midnight) |
| 429  | `rate_limited`           | More than 30 requests per minute for one user                |
| 502  | `ai_invalid`             | Model output failed validation twice and no fallback exists  |
| 503  | `ai_unavailable`         | No Gemini key or Gemini down, and no fallback exists         |
| 503  | `billing_not_configured` | No Stripe test key configured                                |

`retryAfterSeconds` is present only on 429.

## Quota

- Free plan: 20 AI requests per UTC day. Pro plan: 200.
- One AI request is one call to an `/api/ai/*` route that reaches Gemini.
  Coach continuations that only carry a `toolResult` do not count.
  Responses served from a fallback or a refusal do not count.
- Stored server-side in Firestore `usage/{uid}` as `{ day: "YYYY-MM-DD", count }`.
- Plan stored server-side in `billing/{uid}` as `{ plan, stripeCustomerId?, stripeSubscriptionId?, updatedAt }`.
  Clients may read both documents but never write them.

## Routes

### `GET /api/health`

`{ "status": "ok", "version": "0.1.0" }`

### `GET /api/me`

```json
{
  "uid": "abc",
  "plan": "free",
  "usage": { "used": 3, "limit": 20, "resetsAt": "2026-11-11T00:00:00Z" },
  "features": { "ai": true, "billing": false }
}
```

`features.ai` is false when no Gemini key is configured, `features.billing`
false when no Stripe test key is configured. The web app hides or labels
features accordingly.

### `POST /api/ai/health-tips`

Request:

```json
{
  "locale": "en",
  "currency": "USD",
  "score": 62,
  "factors": [
    {
      "id": "savingsRate",
      "value": 0.12,
      "points": 15,
      "maxPoints": 25,
      "status": "fair",
      "healthy": "20% or more"
    }
  ]
}
```

- `factors`: 1 to 4 items, `id` unique, one of `savingsRate emergencyFund debtToIncome fixedCosts`.
- `value` is a ratio (0.12 = 12%) except `emergencyFund`, which is months of essential spending.
- `status` is `good fair poor unknown`. `healthy` is a short label (max 60 chars).

Response: `{ "tips": [{ "factorId": "savingsRate", "text": "..." }], "source": "ai" }`

- Exactly one tip per requested factor, `text` 1 to 280 chars, no numbers that
  were not in the request. Fallback: localized rule-based tip per factor and status.

### `POST /api/ai/categorize`

Request:

```json
{
  "locale": "en",
  "categories": ["groceries", "dining", "transport", "other"],
  "transactions": [
    {
      "id": "row-1",
      "description": "CARREFOUR CITY 123",
      "amount": 4520,
      "currency": "USD",
      "type": "expense"
    }
  ]
}
```

- 1 to 100 transactions, `id` max 64 chars and unique, `description` max 200 chars.
- `categories`: 1 to 18 allowed ids.

Response: `{ "suggestions": [{ "id": "row-1", "categoryId": "groceries", "confidence": 0.9 }], "source": "ai" }`

- Server drops suggestions whose `id` was not requested or whose `categoryId`
  is not in `categories`. `confidence` in 0..1. No fallback: 503 when AI is off
  (the web app has its own keyword rules).

### `POST /api/ai/checkin`

Request:

```json
{
  "locale": "en",
  "currency": "USD",
  "month": "2026-10",
  "income": 420000,
  "spending": 351000,
  "savingsRate": 0.164,
  "categories": [{ "categoryId": "dining", "planned": 20000, "actual": 31000 }],
  "goals": [
    {
      "id": "g1",
      "name": "Car",
      "target": 1000000,
      "saved": 250000,
      "onTrack": false,
      "projectedMonth": "2028-03"
    }
  ],
  "scoreChange": 4
}
```

- `categories` 1 to 18, `goals` 0 to 10, `scoreChange` integer or null.

Response:

```json
{
  "summary": "max 800 chars",
  "highlights": ["max 160 chars each, 0 to 4"],
  "questions": [{ "id": "q1", "text": "max 200 chars" }],
  "adjustments": [
    { "id": "a1", "categoryId": "dining", "changePercent": -10, "reason": "max 200 chars" }
  ],
  "source": "ai"
}
```

- `questions`: 2 to 3. `adjustments`: 0 to 4, `categoryId` must appear in the
  request, `changePercent` a non-zero integer in -30..30. The web app computes
  the new amounts. Fallback: rule-based summary and adjustments for the two
  most over-budget categories.

### `POST /api/ai/coach`

Request:

```json
{
  "locale": "en",
  "currency": "USD",
  "context": {
    "month": "2026-11",
    "monthlyIncome": 420000,
    "monthlySpending": 351000,
    "savingsRate": 0.164,
    "savingsBalance": 800000,
    "emergencyFund": 600000,
    "emergencyMonths": 2.4,
    "healthScore": 62,
    "categories": [{ "categoryId": "dining", "planned": 20000, "actual": 31000 }],
    "goals": [
      {
        "id": "g1",
        "name": "Car",
        "target": 1000000,
        "saved": 250000,
        "targetDate": "2027-12-01",
        "projectedMonth": "2028-03"
      }
    ],
    "debts": [{ "id": "d1", "name": "Card", "balance": 250000, "aprBps": 2400, "minPayment": 7500 }]
  },
  "messages": [
    { "role": "user", "text": "Can I afford a $900 phone in March?" },
    {
      "role": "assistant",
      "toolCall": {
        "id": "c1",
        "name": "check_affordability",
        "args": { "amountMajor": 900, "month": "2027-03" }
      }
    },
    {
      "role": "tool",
      "toolResult": { "id": "c1", "name": "check_affordability", "result": { "affordable": true } }
    }
  ]
}
```

- `messages`: 1 to 24 items. Each is exactly one of
  `{role:"user", text}`, `{role:"assistant", text}`,
  `{role:"assistant", toolCall:{id,name,args}}`, `{role:"tool", toolResult:{id,name,result}}`.
  `text` max 2000 chars. The last message is `user` or `tool`. A `tool`
  message must follow the `assistant` `toolCall` with the same `id`.
- `toolResult.result` is an object computed by the web app's finance module
  (max 8 KB serialized). The model only explains it.

Response is one of:

```json
{ "type": "message", "text": "max 2000 chars", "refusal": false, "source": "ai" }
{ "type": "tool_call", "toolCall": { "id": "c1", "name": "check_affordability", "args": { "amountMajor": 900, "month": "2027-03" } }, "source": "ai" }
```

Tools the model may call. The server validates `args` against these shapes
and retries once if they fail.

| name                      | args                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check_affordability`     | `amountMajor` number > 0, `month` `YYYY-MM`, `label` string max 60 (optional)                                                                    |
| `simulate_scenario`       | `extraSavingsMajor` number >= 0 (default 0), `categoryCuts` list of `{categoryId, percent 1..100}` max 5, `incomeChangeMajor` number (default 0) |
| `project_goal`            | `goalId` string that exists in `context.goals`                                                                                                   |
| `compare_debt_strategies` | `extraPerMonthMajor` number >= 0 (default 0)                                                                                                     |

Guardrails:

- Requests asking for investment, tax, legal or credit advice, or for
  specific financial products, stocks or crypto, get a polite localized
  refusal with `refusal: true`, decided by a deterministic pre-filter before
  any model call. The system prompt repeats the rule and a post-filter
  replaces model text that recommends products, tickers or crypto.
- The model is told it must never compute numbers itself and must call a tool
  for any what-if, affordability, goal or debt question.
- Fallback when AI is off: a short localized message that explains the coach
  needs AI and points to the simulator.

### `POST /api/billing/checkout`

Request `{ "locale": "en" }`. Response `{ "url": "https://checkout.stripe.com/..." }`.
Creates a Stripe Checkout Session in **test mode** (the server refuses any key
that does not start with `sk_test_`), subscription mode, inline price
`USD 5.00 / month`, `client_reference_id = uid`, success URL
`{APP_URL}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel URL
`{APP_URL}/pricing`.

### `POST /api/billing/confirm`

Request `{ "sessionId": "cs_test_..." }`. Retrieves the session from Stripe; if
it is complete, paid and `client_reference_id` equals the caller's uid, sets
`billing/{uid}.plan = "pro"`. Response `{ "plan": "pro" }`. 404 when the session
does not belong to the caller.

### `POST /api/billing/cancel`

Cancels the caller's Stripe subscription immediately (test mode) and sets the
plan to free. Response `{ "plan": "free" }`.

### `POST /api/billing/webhook`

Unauthenticated, verified with the `Stripe-Signature` header and the webhook
secret. Handles `checkout.session.completed` (set pro) and
`customer.subscription.deleted` (set free). Optional: confirm covers the happy
path without a webhook. 400 on bad signature, 503 when no secret configured.

### `DELETE /api/account`

Deletes `users/{uid}` recursively, `billing/{uid}`, `usage/{uid}`, cancels any
Stripe subscription and deletes the Firebase Auth user. Response 204.
