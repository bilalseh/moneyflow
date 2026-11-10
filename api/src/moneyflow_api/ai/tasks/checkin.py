from typing import Any

from pydantic import BaseModel

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.ai.gemini_format import (
    GeminiReply,
    GenerationOptions,
    JsonObject,
    build_request,
    user_text,
)
from moneyflow_api.ai.prompts import CHECKIN_TASK, data_block, system_parts
from moneyflow_api.ai.response_schemas import checkin_schema
from moneyflow_api.ai.runner import parse_json_reply
from moneyflow_api.ai.tasks.common import category_rows, ensure_policy_compliant
from moneyflow_api.ai.text import clip
from moneyflow_api.money import format_minor, format_percent
from moneyflow_api.schemas.checkin import (
    HIGHLIGHT_MAX,
    MAX_ADJUSTMENTS,
    MAX_CHANGE_PERCENT,
    MAX_HIGHLIGHTS,
    MAX_QUESTIONS,
    MIN_QUESTIONS,
    QUESTION_MAX,
    REASON_MAX,
    SUMMARY_MAX,
    Adjustment,
    CheckinRequest,
    CheckinResponse,
    Question,
)
from moneyflow_api.schemas.common import CategoryId


class _RawCheckin(BaseModel):
    summary: str
    highlights: list[Any] = []
    questions: list[Any]
    adjustments: list[Any] = []


def build_body(request: CheckinRequest) -> JsonObject:
    payload = {
        "month": request.month,
        "income": format_minor(request.income, request.currency),
        "spending": format_minor(request.spending, request.currency),
        "savingsRate": format_percent(request.savingsRate),
        "scoreChange": request.scoreChange,
        "categories": category_rows(request.categories, request.currency),
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target": format_minor(g.target, request.currency),
                "saved": format_minor(g.saved, request.currency),
                "onTrack": g.onTrack,
                "projectedMonth": g.projectedMonth,
            }
            for g in request.goals
        ],
    }
    return build_request(
        system=system_parts(request.locale, CHECKIN_TASK),
        contents=[user_text(data_block("month", payload))],
        options=GenerationOptions(
            temperature=0.5,
            max_output_tokens=2048,
            response_schema=checkin_schema([c.categoryId for c in request.categories]),
        ),
    )


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _change_percent(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    if isinstance(value, float) and not value.is_integer():
        return None
    percent = int(value)
    return percent if percent != 0 and abs(percent) <= MAX_CHANGE_PERCENT else None


def _adjustments(raw: list[Any], allowed: set[CategoryId]) -> list[Adjustment]:
    adjustments: list[Adjustment] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        category, reason = item.get("categoryId"), _text(item.get("reason"))
        percent = _change_percent(item.get("changePercent"))
        if category not in allowed or category in seen or percent is None or not reason:
            continue
        seen.add(category)
        adjustments.append(
            Adjustment(
                id=f"a{len(adjustments) + 1}",
                categoryId=category,
                changePercent=percent,
                reason=clip(reason, REASON_MAX),
            )
        )
    return adjustments[:MAX_ADJUSTMENTS]


def parse_reply(request: CheckinRequest, reply: GeminiReply) -> CheckinResponse:
    """Normalize the model's check-in: clip text, drop bad items, assign stable ids."""
    raw = parse_json_reply(reply, _RawCheckin)
    summary = raw.summary.strip()
    if not summary:
        raise AiInvalidOutputError("empty summary")
    highlights = [t for t in map(_text, raw.highlights) if t][:MAX_HIGHLIGHTS]
    question_texts = [
        _text(q.get("text")) if isinstance(q, dict) else _text(q) for q in raw.questions
    ]
    question_texts = [t for t in question_texts if t][:MAX_QUESTIONS]
    if len(question_texts) < MIN_QUESTIONS:
        raise AiInvalidOutputError("fewer than two questions")
    adjustments = _adjustments(raw.adjustments, {c.categoryId for c in request.categories})
    ensure_policy_compliant(summary, *highlights, *question_texts, *(a.reason for a in adjustments))
    return CheckinResponse(
        summary=clip(summary, SUMMARY_MAX),
        highlights=[clip(h, HIGHLIGHT_MAX) for h in highlights],
        questions=[
            Question(id=f"q{i}", text=clip(t, QUESTION_MAX))
            for i, t in enumerate(question_texts, start=1)
        ],
        adjustments=adjustments,
        source="ai",
    )
