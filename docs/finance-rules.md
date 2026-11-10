# Finance rules

Every number Moneyflow shows comes from the pure finance module in
`shared/src/finance/`. It has no framework, network or storage dependencies
and is covered by unit tests next to each file. The AI never computes any of
these values; it receives them and explains them.

## Money

- Amounts are integers in minor units (cents, fils, piastres) of their own
  currency. Minor-unit exponents follow ISO 4217 (USD 2, LBP 0, JOD 3).
- Manual exchange rates are decimal strings relative to the main currency
  (`EUR: "1.08"` means 1 EUR = 1.08 of the main currency). Conversion runs on
  BigInt and rounds half away from zero, so large amounts never lose precision.
- When a currency has no rate, totals skip it and the UI asks for the rate.
- Splits use the largest remainder method so parts always add up exactly.

## Monthly totals

- **Income**: transactions of type income.
- **Spending**: expenses in the needs and wants groups.
- **Savings transfers**: expenses booked to the savings category. They are not
  spending.
- **Savings rate** = (income - spending) / income. Undefined without income.
- **Essential spending**: spending in the needs group (housing, utilities,
  groceries, transport, health, insurance, education, debt payments).

## Health score (0 to 100)

Four factors, 25 points each. Each scores linearly between a zero-points value
and a full-points value, rounded to the nearest point.

| Factor           | Definition                                  | Full points | Zero points |
| ---------------- | ------------------------------------------- | ----------- | ----------- |
| Savings rate     | (income - spending) / income                | 20% or more | 0% or less  |
| Emergency fund   | emergency fund / monthly essential spending | 6 months    | 0 months    |
| Debt to income   | monthly minimum debt payments / income      | 10% or less | 43% or more |
| Fixed-cost ratio | monthly fixed costs / income                | 50% or less | 85% or more |

Status per factor: 20 to 25 points is good, 10 to 19 fair, below 10 poor.
Without income the three ratio factors are "unknown" and score 0. An
emergency fund with no essential spending recorded counts as fully covered.

The score is saved once per month in `users/{uid}/scores/{YYYY-MM}` to build
the history chart.

## Budget methods

All methods honour fixed costs and minimum debt payments first.

- **50/30/20**: needs get 50% of income, wants 30%, savings 20%. Fixed costs
  and debt minimums come out of needs; the rest of needs and all of wants are
  spread across variable categories in proportion to recent spending (or
  default weights for a new user). If commitments exceed the needs share, the
  overflow is taken from wants, then savings, and the plan is flagged as
  over-committed.
- **Zero-based**: every unit of income gets a job. After commitments and goal
  contributions, each variable category is funded up to its historical
  average; anything left goes to savings. A new user without history gets 80%
  of the free money spread by default weights and 20% to savings.
- **Custom**: starts from historical averages plus commitments. The user edits
  any line; the plan shows what is left unassigned (or over-planned).

## Goals

- Goals share one monthly contribution, split by priority weight (high 3,
  medium 2, low 1) and capped at what each goal still needs. When a goal
  completes, its share flows to the others the following month.
- Projection runs month by month for up to 240 months. A goal that is not
  reached in that window is "not at this pace".
- Required monthly amount for a deadline = remaining / months until the target
  month, rounded up.

## Debt payoff

- Interest each month = balance x APR / 12, rounded half up, using integer math.
- The monthly budget is the sum of minimum payments plus any extra. Minimums
  are paid first; the rest goes to the target debt; money freed by a paid-off
  debt rolls into the next one.
- **Avalanche** targets the highest APR first (ties: smaller balance).
  **Snowball** targets the smallest balance first (ties: higher APR).
- A plan that is not finished after 600 months is infeasible, which happens
  when payments do not cover interest.

## What-if simulator

- surplus = income - spending.
- Goals receive the planned goal contribution, never more than the surplus.
- The free cash flow (surplus minus goal contributions) accumulates in liquid
  savings each month. A negative flow is shown as drawing down savings.
- "Save X more per month" lowers wants spending by X, proportionally across
  wants categories and capped at the wants total, and sends X to goals. Any
  part wants cannot cover is reported as a shortfall.
- "Cut category Y by Z%" lowers that category's spending, which raises the
  free cash flow.
- "Income changes by N" adjusts income, never below zero.
- The health score is recomputed for the scenario.

## Affordability

A purchase of amount A in month M is affordable when the projected liquid
savings at M (current liquid savings + free cash flow x months until M), minus
A, still leaves one month of essential spending as a buffer. The emergency
fund is never counted. If it does not fit, the earliest month it would fit is
reported (searching up to 60 months), plus how many months the top goal would
slip if it were paid from goal contributions instead.

## Recurring charges and subscriptions

- Expenses are grouped by a normalized merchant key (lowercase letters only,
  digits and noise words like "payment" or "pos" removed).
- Within a group, charges more than 15% away from the median amount are
  ignored.
- The gaps between the remaining charges must all fall in one window: weekly
  6 to 8 days (at least 3 charges), monthly 26 to 35 days (at least 2), yearly
  350 to 380 days (at least 2).
- Yearly total = average amount x 52, 12 or 1. Subscriptions the user has not
  marked as "used" are flagged.

## CSV import

- Parser: RFC 4180 quoting, CRLF or LF, BOM stripped, delimiter sniffed from
  comma, semicolon, tab and pipe. Limit 5,000 rows.
- Dates: YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY (any of `- / .`), detected from
  the data, YMD preferred, then DMY, then MDY.
- Amounts: thousands separators, comma or dot decimals, parentheses or a minus
  sign for negatives, currency symbols ignored. Either one signed amount
  column or separate debit and credit columns.
- Duplicates: a row matches a stored transaction when amount, type and
  merchant key are equal and the dates are at most one day apart; a row also
  duplicates an earlier identical row of the same file.
- Exports escape cells that start with `= + - @` so spreadsheets do not run
  them as formulas.
