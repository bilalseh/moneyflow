"""Rule-based check-in built only from the numbers in the request.

The only logic is comparison: categories where actual > planned are ranked by
how far over plan they went, and the top two get a -10% adjustment.
"""

from moneyflow_api.ai.fallbacks.labels import CATEGORY_LABELS, month_label
from moneyflow_api.ai.text import clip
from moneyflow_api.money import format_minor, format_percent
from moneyflow_api.schemas.checkin import (
    HIGHLIGHT_MAX,
    MAX_HIGHLIGHTS,
    REASON_MAX,
    SUMMARY_MAX,
    Adjustment,
    CheckinGoal,
    CheckinRequest,
    CheckinResponse,
    Question,
)
from moneyflow_api.schemas.common import CategoryAmount, Locale

FALLBACK_CHANGE_PERCENT = -10

_TEXT: dict[Locale, dict[str, str]] = {
    "en": {
        "summary": "In {month}, your income was {income} and your spending was {spending}. "
        "Your savings rate was {rate}.",
        "score_up": " Your health score went up by {points} points.",
        "score_down": " Your health score went down by {points} points.",
        "score_same": " Your health score held steady.",
        "over_two": " {first} and {second} went over plan.",
        "over_one": " {first} went over plan.",
        "within": " Every category stayed within plan. Nice work.",
        "over_highlight": "{category}: {actual} spent against {planned} planned.",
        "goal_on_track": "{name} is on track.",
        "goal_behind": "{name} is behind plan.",
        "goal_behind_month": "{name} is behind plan, now projected for {month}.",
        "q1": "Which purchase this month felt most worth it, and which would you skip next time?",
        "q2": "Is there one bill or subscription you could review before next month?",
        "reason": "You spent more than planned here. Trimming this category a little keeps "
        "next month realistic.",
    },
    "ar": {
        "summary": "في {month}، كان دخلك {income} وكانت مصاريفك {spending}. "
        "وبلغت نسبة ادخارك {rate}.",
        "score_up": " ارتفع مؤشر صحتك المالية بمقدار {points} نقاط.",
        "score_down": " انخفض مؤشر صحتك المالية بمقدار {points} نقاط.",
        "score_same": " بقي مؤشر صحتك المالية ثابتًا.",
        "over_two": " تجاوزت فئتا {first} و{second} الخطة.",
        "over_one": " تجاوزت فئة {first} الخطة.",
        "within": " بقيت كل الفئات ضمن الخطة. أحسنت.",
        "over_highlight": "{category}: صرفت {actual} مقابل {planned} في الخطة.",
        "goal_on_track": "هدف {name} يسير وفق الخطة.",
        "goal_behind": "هدف {name} متأخر عن الخطة.",
        "goal_behind_month": "هدف {name} متأخر عن الخطة، والموعد المتوقع الآن {month}.",
        "q1": "أي عملية شراء هذا الشهر كانت الأكثر قيمة، وأيها ستتجنبها في المرة القادمة؟",
        "q2": "هل هناك فاتورة أو اشتراك واحد يمكنك مراجعته قبل الشهر القادم؟",
        "reason": "صرفت هنا أكثر من المخطط. تقليل هذه الفئة قليلًا يجعل خطة الشهر القادم "
        "أكثر واقعية.",
    },
}


def most_over_budget(categories: list[CategoryAmount], limit: int = 2) -> list[CategoryAmount]:
    over = [c for c in categories if c.actual > c.planned]
    return sorted(over, key=lambda c: c.actual - c.planned, reverse=True)[:limit]


def _summary(request: CheckinRequest, over: list[CategoryAmount]) -> str:
    text = _TEXT[request.locale]
    labels = CATEGORY_LABELS[request.locale]
    summary = text["summary"].format(
        month=month_label(request.month, request.locale),
        income=format_minor(request.income, request.currency),
        spending=format_minor(request.spending, request.currency),
        rate=format_percent(request.savingsRate),
    )
    if request.scoreChange is not None:
        if request.scoreChange > 0:
            summary += text["score_up"].format(points=request.scoreChange)
        elif request.scoreChange < 0:
            summary += text["score_down"].format(points=-request.scoreChange)
        else:
            summary += text["score_same"]
    if len(over) >= 2:
        summary += text["over_two"].format(
            first=labels[over[0].categoryId], second=labels[over[1].categoryId]
        )
    elif over:
        summary += text["over_one"].format(first=labels[over[0].categoryId])
    else:
        summary += text["within"]
    return clip(summary, SUMMARY_MAX)


def _goal_highlight(goal: CheckinGoal, locale: Locale) -> str:
    text = _TEXT[locale]
    if goal.onTrack:
        return text["goal_on_track"].format(name=goal.name)
    if goal.projectedMonth:
        month = month_label(goal.projectedMonth, locale)
        return text["goal_behind_month"].format(name=goal.name, month=month)
    return text["goal_behind"].format(name=goal.name)


def _highlights(request: CheckinRequest, over: list[CategoryAmount]) -> list[str]:
    text = _TEXT[request.locale]
    labels = CATEGORY_LABELS[request.locale]
    highlights = [
        text["over_highlight"].format(
            category=labels[c.categoryId],
            actual=format_minor(c.actual, request.currency),
            planned=format_minor(c.planned, request.currency),
        )
        for c in over
    ]
    highlights += [_goal_highlight(goal, request.locale) for goal in request.goals]
    return [clip(h, HIGHLIGHT_MAX) for h in highlights[:MAX_HIGHLIGHTS]]


def checkin_fallback(request: CheckinRequest) -> CheckinResponse:
    text = _TEXT[request.locale]
    over = most_over_budget(request.categories)
    adjustments = [
        Adjustment(
            id=f"a{index}",
            categoryId=category.categoryId,
            changePercent=FALLBACK_CHANGE_PERCENT,
            reason=clip(text["reason"], REASON_MAX),
        )
        for index, category in enumerate(over, start=1)
    ]
    return CheckinResponse(
        summary=_summary(request, over),
        highlights=_highlights(request, over),
        questions=[Question(id="q1", text=text["q1"]), Question(id="q2", text=text["q2"])],
        adjustments=adjustments,
        source="fallback",
    )
