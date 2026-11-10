from moneyflow_api.ai.flow import FallbackReason
from moneyflow_api.ai.guardrail_patterns import Topic
from moneyflow_api.ai.guardrails import refusal_text
from moneyflow_api.schemas.coach import CoachMessageResponse
from moneyflow_api.schemas.common import Locale

_UNAVAILABLE: dict[Locale, str] = {
    "en": (
        "The AI coach isn't available right now, so I can't answer chat questions. You can "
        "still explore affordability checks, what-if scenarios, goals and debt payoff plans "
        "in the simulator, which uses the same math."
    ),
    "ar": (
        "المدرّب الذكي غير متاح حاليًا، لذا لا أستطيع الإجابة عن أسئلة المحادثة. ما زال بإمكانك "
        "تجربة فحص القدرة على الشراء وسيناريوهات ماذا لو والأهداف وخطط سداد الديون في المحاكي، "
        "فهو يستخدم الحسابات نفسها."
    ),
}

_INVALID: dict[Locale, str] = {
    "en": (
        "I couldn't put together a reliable answer this time. Please try rephrasing, or use "
        "the simulator to explore scenarios with exact numbers."
    ),
    "ar": (
        "لم أتمكن من إعداد إجابة موثوقة هذه المرة. حاول إعادة صياغة سؤالك، أو استخدم المحاكي "
        "لتجربة السيناريوهات بأرقام دقيقة."
    ),
}


def coach_fallback(locale: Locale, reason: FallbackReason) -> CoachMessageResponse:
    text = _INVALID[locale] if reason == "invalid" else _UNAVAILABLE[locale]
    return CoachMessageResponse(text=text, refusal=False, source="fallback")


def coach_refusal(locale: Locale, topic: Topic) -> CoachMessageResponse:
    return CoachMessageResponse(text=refusal_text(locale, topic), refusal=True, source="fallback")
