import uuid

from moneyflow_api.ai.client import AiInvalidOutputError
from moneyflow_api.ai.fallbacks.coach import coach_refusal
from moneyflow_api.ai.gemini_format import GeminiReply, GenerationOptions, JsonObject, build_request
from moneyflow_api.ai.guardrail_patterns import Topic
from moneyflow_api.ai.guardrails import violates_output_policy
from moneyflow_api.ai.history import build_contents
from moneyflow_api.ai.prompts import COACH_TASK, data_block, system_parts
from moneyflow_api.ai.tasks.common import category_rows
from moneyflow_api.ai.text import clip
from moneyflow_api.ai.tools import function_declarations, validate_tool_args
from moneyflow_api.money import format_bps, format_decimal, format_minor, format_percent
from moneyflow_api.schemas.coach import (
    TEXT_MAX,
    CoachContext,
    CoachMessageResponse,
    CoachRequest,
    CoachToolCall,
    CoachToolCallResponse,
)

TOOL_CALL_ID_LENGTH = 12


def new_tool_call_id() -> str:
    return f"call_{uuid.uuid4().hex[:TOOL_CALL_ID_LENGTH]}"


def context_payload(context: CoachContext, currency: str) -> JsonObject:
    def money(amount: int) -> str:
        return format_minor(amount, currency)

    return {
        "month": context.month,
        "currency": currency,
        "monthlyIncome": money(context.monthlyIncome),
        "monthlySpending": money(context.monthlySpending),
        "savingsRate": format_percent(context.savingsRate),
        "savingsBalance": money(context.savingsBalance),
        "emergencyFund": money(context.emergencyFund),
        "emergencyMonths": format_decimal(context.emergencyMonths),
        "healthScore": context.healthScore,
        "categories": category_rows(context.categories, currency),
        "goals": [
            {
                "id": g.id,
                "name": g.name,
                "target": money(g.target),
                "saved": money(g.saved),
                "targetDate": g.targetDate,
                "projectedMonth": g.projectedMonth,
            }
            for g in context.goals
        ],
        "debts": [
            {
                "id": d.id,
                "name": d.name,
                "balance": money(d.balance),
                "apr": format_bps(d.aprBps),
                "minPayment": money(d.minPayment),
            }
            for d in context.debts
        ],
    }


def build_body(request: CoachRequest) -> JsonObject:
    return build_request(
        system=system_parts(
            request.locale,
            COACH_TASK,
            data_block("context", context_payload(request.context, request.currency)),
        ),
        contents=build_contents(request.messages),
        options=GenerationOptions(temperature=0.5, max_output_tokens=1024),
        function_declarations=function_declarations([g.id for g in request.context.goals]),
    )


def parse_reply(
    request: CoachRequest, reply: GeminiReply
) -> CoachMessageResponse | CoachToolCallResponse:
    """Prefer a function call; otherwise return post-filtered, length-limited text."""
    if reply.function_calls:
        call = reply.function_calls[0]
        args = validate_tool_args(call.name, call.args, {g.id for g in request.context.goals})
        tool_call = CoachToolCall.model_validate(
            {"id": new_tool_call_id(), "name": call.name, "args": args}
        )
        return CoachToolCallResponse(toolCall=tool_call, source="ai")
    text = reply.text.strip()
    if not text:
        reason = reply.block_reason or reply.finish_reason or "empty"
        raise AiInvalidOutputError(f"no text or function call in reply ({reason})")
    if violates_output_policy(text):
        return coach_refusal(request.locale, Topic.PRODUCTS)
    return CoachMessageResponse(text=clip(text, TEXT_MAX), refusal=False, source="ai")
