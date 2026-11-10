# Moneyflow API

FastAPI backend for Moneyflow. It verifies Firebase ID tokens on every request,
enforces per-user rate limits and daily AI quotas, talks to Gemini on the
user's behalf and runs Stripe billing in test mode. All money math lives in
deterministic code; the AI only explains and suggests.

The HTTP contract is [`docs/api-contract.md`](../docs/api-contract.md). The
Pydantic models in `src/moneyflow_api/schemas/` mirror it field for field.

## Routes

| Method | Path                    | Auth   | Notes                                           |
| ------ | ----------------------- | ------ | ----------------------------------------------- |
| GET    | `/api/health`           | none   | Liveness and version                            |
| GET    | `/api/me`               | bearer | Plan, today's AI usage, feature flags           |
| POST   | `/api/ai/health-tips`   | bearer | One tip per factor; fallback per factor/status  |
| POST   | `/api/ai/categorize`    | bearer | Category suggestions; no fallback (503)         |
| POST   | `/api/ai/checkin`       | bearer | Monthly summary; rule-based fallback            |
| POST   | `/api/ai/coach`         | bearer | Chat with tool calls; guardrails; fallback      |
| POST   | `/api/billing/checkout` | bearer | Stripe Checkout session (test mode)             |
| POST   | `/api/billing/confirm`  | bearer | Verify a paid session and upgrade to pro        |
| POST   | `/api/billing/cancel`   | bearer | Cancel the subscription, back to free           |
| POST   | `/api/billing/webhook`  | Stripe | Signature-verified webhook                      |
| DELETE | `/api/account`          | bearer | Cancel billing, delete data and the auth user   |

## Modules

```
src/moneyflow_api/
  main.py          create_app(settings, services): routers, error handlers, CORS
  config.py        Settings (env prefix MONEYFLOW_), test-key-only Stripe logic
  services.py      Services container (stores, AI client, Stripe) and production wiring
  deps.py          FastAPI dependencies resolved from app.state
  auth.py          Firebase ID token verification behind a TokenVerifier Protocol
  ratelimit.py     In-memory sliding window, 30 requests per minute per uid
  quota.py         Daily AI quota by plan, resetting at UTC midnight
  errors.py        ApiError and handlers that render {"error": {code, message}}
  firebase.py      Lazy Firebase Admin initialization (ADC, configured project)
  money.py         Formatting minor units and ratios for prompts and fallbacks
  schemas/         Request and response models, strict, extra="forbid"
  stores/          UsageStore, BillingStore, AccountStore: Protocols, Firestore, in-memory
  ai/
    client.py          AiClient Protocol and the Gemini REST client (httpx)
    gemini_format.py   Pure request builder and response parser
    flow.py            AI vs fallback vs error, and when quota is charged
    runner.py          Validate model output, retry once on invalid output
    prompts.py         Versioned system prompts and untrusted-data delimiting
    guardrails.py      Pre-filter, post-filter and localized refusals
    guardrail_patterns.py  The English and Arabic regexes
    tools.py           Coach tool declarations and argument validation
    history.py         Chat messages to Gemini contents
    response_schemas.py  responseSchema per JSON route
    text.py            Clipping and the "no invented numbers" check
    tasks/             One module per route: build the request, normalize the reply
    fallbacks/         Deterministic en and ar responses
  billing/
    gateway.py     BillingGateway Protocol and the Stripe wrapper
    service.py     Checkout, confirm, cancel and webhook use cases
  routes/          health, me, ai, billing, account
```

## How AI is kept away from the math

- The web app's finance module computes every number. The API passes those
  numbers to Gemini already formatted (`351000` USD becomes `"3,510.00 USD"`,
  `0.164` becomes `"16.4%"`) and comparisons such as `overPlan` precomputed, so
  the model only has to restate them.
- The system prompt forbids inventing or calculating numbers. For health tips
  the server enforces it: any number in a tip that is not in the request makes
  the reply invalid (Arabic-Indic digits included).
- The coach must call a tool (`check_affordability`, `simulate_scenario`,
  `project_goal`, `compare_debt_strategies`) for any what-if, affordability,
  goal or debt question. The server validates the tool arguments, generates the
  tool call id, and returns the call to the web app, which runs the math and
  sends the result back for the model to explain.
- JSON routes use Gemini's JSON mode with a per-route `responseSchema`, then
  Pydantic validation and normalization (clip text, drop bad items, assign
  stable ids). Invalid output is retried once, then the deterministic fallback
  is served (`source: "fallback"`), or 502 `ai_invalid` for categorize.

## Guardrails

- **Pre-filter** (`ai/guardrails.py`): the latest user chat message is checked
  for investment, securities, crypto, tax, legal and credit-product requests in
  English and Arabic. Text is normalized first (case, width, Arabic diacritics,
  alef and yaa forms). A match returns a localized refusal that explains why,
  with `refusal: true`, `source: "fallback"`, no model call and no quota use.
- Patterns target requests for advice or products, not budgeting words, so
  "taxi", "how do I pay off my credit card faster", "investing time in
  budgeting" and "can I afford a phone" all pass. `tests/test_guardrails.py`
  holds both lists.
- **Post-filter**: model text that names tickers, crypto or pushes products is
  replaced by the refusal; in JSON routes it makes the reply invalid.
- **Untrusted data**: transaction descriptions, goal names and other strings
  travel as JSON inside `<data>` blocks with `<` and `>` escaped, chat text
  inside `<user_message>` tags with any such tags stripped, and the prompt says
  that this content is data, never instructions.
- **Output limits**: free text is clipped at a word boundary to the contract
  limits; list lengths are capped.

## Quota and rate limits

- Free 20 and pro 200 AI requests per UTC day, stored in `usage/{uid}` with an
  atomic Firestore transaction. Checked before calling Gemini; charged only
  when the response served came from the model (or for 502 `ai_invalid`).
  Fallbacks, refusals and coach tool-result continuations are free.
- 30 requests per minute per uid across authenticated routes, in memory per
  instance (at most two Cloud Run instances).

## Environment

All variables use the `MONEYFLOW_` prefix; see [`.env.example`](.env.example).

| Variable                  | Default                          | Meaning                                       |
| ------------------------- | -------------------------------- | --------------------------------------------- |
| `ENV`                     | `development`                    | `production` hides the OpenAPI docs           |
| `FIREBASE_PROJECT_ID`     | `moneyflow-coach`                | Project whose ID tokens are accepted          |
| `CORS_ORIGINS`            | `["http://localhost:5173"]`      | JSON list of allowed origins                  |
| `GEMINI_API_KEY`          | empty                            | Empty turns AI off (fallbacks are served)     |
| `GEMINI_MODEL`            | `gemini-2.5-flash`               | Model name                                    |
| `GEMINI_TIMEOUT_SECONDS`  | `20`                             | Per call                                      |
| `STRIPE_SECRET_KEY`       | empty                            | Only `sk_test_...` enables billing            |
| `STRIPE_WEBHOOK_SECRET`   | empty                            | Empty makes the webhook return 503            |
| `PRO_PRICE_CENTS`         | `500`                            | Monthly price in USD cents                    |
| `APP_URL`                 | `https://moneyflow-coach.web.app` | Base for Stripe success and cancel URLs      |
| `FREE_DAILY_AI`           | `20`                             | Free plan daily AI requests                   |
| `PRO_DAILY_AI`            | `200`                            | Pro plan daily AI requests                    |

Production uses Application Default Credentials for Firebase Admin. Nothing is
initialized until the first request needs it.

## Run locally

```bash
uv sync
cp .env.example .env
uv run uvicorn moneyflow_api.main:app --reload --port 8080
```

Open http://localhost:8080/api/health and http://localhost:8080/api/docs.

## Tests and quality gates

```bash
uv run ruff check . && uv run ruff format --check .
uv run mypy .
uv run pytest
```

Tests never touch the network: `create_app(settings, services)` receives fake
token verification, in-memory stores, a scripted AI client and a fake Stripe
gateway. The Gemini request builder and parser are tested against recorded
response shapes in `tests/fixtures/gemini/`, the Gemini client against an
`httpx.MockTransport`, and Stripe webhook signatures with locally computed
HMACs.

## Docker

```bash
docker build -t moneyflow-api .
docker run --rm -p 8080:8080 --env-file .env moneyflow-api
```

The container listens on `PORT` (default 8080), which is what Cloud Run injects.
