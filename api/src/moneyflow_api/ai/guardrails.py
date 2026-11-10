"""Deterministic guardrails around the coach.

- `detect_restricted_topic` runs on the latest user message before any model call.
- `violates_output_policy` runs on model text before it reaches the user.
- `refusal_text` explains, in the user's language, why the coach will not answer.
"""

import re
import unicodedata

from moneyflow_api.ai.guardrail_patterns import (
    OUTPUT_PATTERNS,
    REQUEST_PATTERNS,
    TAX_EXEMPT_PHRASES,
    TICKER_PATTERN,
    Topic,
)
from moneyflow_api.schemas.common import Locale

_ARABIC_MARKS = re.compile("[\u064b-\u065f\u0670\u0640]")
_ALEF_VARIANTS = str.maketrans({"\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627"})
_YAA_VARIANTS = str.maketrans({"\u0649": "\u064a"})


def normalize(text: str) -> str:
    """Fold case and width, strip Arabic diacritics and tatweel, unify alef and yaa forms."""
    text = unicodedata.normalize("NFKC", text).casefold()
    text = _ARABIC_MARKS.sub("", text)
    return text.translate(_ALEF_VARIANTS).translate(_YAA_VARIANTS)


def detect_restricted_topic(text: str) -> Topic | None:
    normalized = TAX_EXEMPT_PHRASES.sub(" ", normalize(text))
    for topic, pattern in REQUEST_PATTERNS:
        if pattern.search(normalized):
            return topic
    return None


def violates_output_policy(text: str) -> bool:
    return bool(TICKER_PATTERN.search(text) or OUTPUT_PATTERNS.search(normalize(text)))


_TOPIC_LABELS: dict[Locale, dict[Topic, str]] = {
    "en": {
        Topic.INVESTMENT: "investment advice",
        Topic.SECURITIES: "stocks or other securities",
        Topic.CRYPTO: "cryptocurrency",
        Topic.TAX: "tax advice",
        Topic.LEGAL: "legal advice",
        Topic.CREDIT: "credit advice or choosing specific financial products",
        Topic.PRODUCTS: "recommending specific financial products",
    },
    "ar": {
        Topic.INVESTMENT: "النصائح الاستثمارية",
        Topic.SECURITIES: "الأسهم والأوراق المالية",
        Topic.CRYPTO: "العملات الرقمية",
        Topic.TAX: "النصائح الضريبية",
        Topic.LEGAL: "الاستشارات القانونية",
        Topic.CREDIT: "النصائح الائتمانية أو اختيار منتجات مالية محددة",
        Topic.PRODUCTS: "التوصية بمنتجات مالية محددة",
    },
}

_REFUSAL_TEMPLATES: dict[Locale, str] = {
    "en": (
        "I can't help with {topic}. Moneyflow is an educational budgeting tool, not a "
        "licensed advisor, so for that please talk to a qualified professional. I'm happy "
        "to help with your budget, savings goals or debt payoff, or you can test a what-if "
        "in the simulator."
    ),
    "ar": (
        "لا أستطيع المساعدة في {topic}. Moneyflow أداة تعليمية لإدارة الميزانية وليست "
        "مستشارًا مرخّصًا، لذا يُرجى استشارة مختص مؤهل في هذا الشأن. يسعدني مساعدتك في "
        "ميزانيتك أو أهداف الادخار أو سداد الديون، ويمكنك أيضًا تجربة سيناريو في المحاكي."
    ),
}


def refusal_text(locale: Locale, topic: Topic) -> str:
    return _REFUSAL_TEMPLATES[locale].format(topic=_TOPIC_LABELS[locale][topic])
