"""Regexes for the deterministic guardrails, in English and Arabic.

English patterns run on lowercased text with word boundaries. Arabic patterns run
on normalized text (no diacritics or tatweel, unified alef and yaa) and allow the
common attached prefixes (wa, fa, bi, li, ka, al) through `_ar`.
Patterns aim at requests for advice or products, not at budgeting vocabulary:
"pay off my credit card", "taxi" or "investing time" must pass.
"""

import re
from enum import StrEnum


class Topic(StrEnum):
    CRYPTO = "crypto"
    SECURITIES = "securities"
    INVESTMENT = "investment"
    TAX = "tax"
    LEGAL = "legal"
    CREDIT = "credit"
    PRODUCTS = "products"


def _ar(core: str) -> str:
    return rf"(?<!\w)(?:[وفبلك]?ال|[وفبلك])?(?:{core})"


def _compile(patterns: list[str]) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns), re.IGNORECASE)


_CRYPTO_EN = (
    r"\b(?:crypto\w*|bitcoins?|btc|ethereum|ether|eth|dogecoin|doge|solana|xrp|litecoin"
    r"|stablecoins?|altcoins?|nfts?|blockchain|binance|coinbase|tether|usdt|web3|defi)\b"
)
_CRYPTO_AR = [
    _ar(r"عمل(?:ة|ات)\s+(?:ال)?(?:رقمي|مشفر|افتراضي)\w*"),
    _ar(r"بيتكوين|بتكوين|بيتكوين|كريبتو|ايثريوم|ايثيريوم|دوجكوين|بلوكتشين|بلوك\s*تشين"),
]

_SECURITIES_EN = [
    r"(?<!in\s)(?<!out\sof\s)\bstocks?\b(?!\s+up\b)",
    r"\b(?:buy|buying|sell|selling|own|owning|purchase|purchasing)\s+(?:some\s+)?shares\b",
    r"\bshares\s+(?:of|in)\s+[a-z]",
    r"\b(?:day\s+trad(?:e|ing)|forex|options\s+trading|futures\s+trading)\b",
    r"\btrading\s+(?:stocks?|options|futures|forex|crypto\w*)\b",
    r"\b(?:dividends?|tickers?|nasdaq|nyse|s&p\s*500|dow\s+jones|ftse|tadawul)\b",
    r"\$[a-z]{1,5}\b",
]
_SECURITIES_AR = [
    _ar(r"اسهم\w*+(?!\s+في)"),
    _ar(r"بورص\w*|فوركس|سندات|صناديق\s+(?:ال)?مؤشرات|تداول\s+(?:ال)?(?:اسهم|عملات)"),
]

_INVESTMENT_EN = [
    r"\b(?:should|could|can|how|where|what)\s+(?:do\s+|can\s+|should\s+)?(?:i|we)\s+invest\b"
    r"(?!\s+(?:my\s+|more\s+|some\s+)?(?:time|energy|effort)\b)",
    r"\binvest(?:ing|ed|s)?\s+(?:my\s+|our\s+|the\s+|some\s+|this\s+)?"
    r"(?:money|savings|cash|salary|bonus|paycheck|income|inheritance|funds|\$?\d)",
    r"\binvest(?:ing|ed|s)?\s+in\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:stocks?|shares|bonds?"
    r"|funds?|etfs?|gold|real\s+estate|propert(?:y|ies)|the\s+market|startups?|compan(?:y|ies))\b",
    r"\binvestments?\s+(?:advice|portfolio|strateg(?:y|ies)|plan|options?|ideas?|accounts?"
    r"|returns?|opportunit(?:y|ies)|tips?)\b",
    r"\b(?:best|good|top|safe|smart|right|which)\s+investments?\b",
    r"\b(?:index|mutual|hedge|money\s+market)\s+funds?\b",
    r"\betfs?\b|\broth\s+ira\b|\b401\s?\(?k\)?",
    r"\b(?:stock|bond|real\s+estate)\s+market\b",
]
_INVESTMENT_AR = [
    _ar(r"استثم(?:ر|ار)\w*+(?!\s+(?:[بل]?ال)?وقت)"),
    _ar(r"محفظ\w*\s+استثمار\w*"),
]

_TAX_EN = [
    r"\btax(?:es)?\s+(?:advice|returns?|deductions?|credits?|brackets?|filing|forms?"
    r"|loopholes?|planning|breaks?|refunds?|strateg(?:y|ies)|liabilit(?:y|ies)|code|law"
    r"|evasion|avoidance|rates?)\b",
    r"\b(?:file|filing|pay|paying|reduce|reducing|lower|lowering|avoid|avoiding|evade"
    r"|evading|minimi[sz]e|cut|save\s+on|owe)\s+(?:less\s+|more\s+|on\s+)?"
    r"(?:my\s+|our\s+|the\s+)?tax(?:es)?\b",
    r"\b(?:do|doing|prepare|preparing)\s+(?:my\s+|our\s+)?taxes\b",
    r"\b(?:tax[-\s]?deductible|write[-\s]?offs?|capital\s+gains|irs|hmrc)\b",
]
_TAX_AR = [_ar(r"ضريب\w*|ضرائب")]
TAX_EXEMPT_PHRASES = re.compile(
    r"\b(?:after|pre|post)[-\s]?tax(?:es)?\b|(?:بعد|قبل)\s+(?:ال)?(?:ضريب\w*|ضرائب)",
    re.IGNORECASE,
)

_LEGAL_EN = [
    r"\blegal(?:ly)?\s+(?:advice|action|help|question|counsel|rights?|issue|problem)\b",
    r"\b(?:lawyers?|attorneys?|solicitors?|lawsuits?|litigation|sue|suing|sued)\b",
    r"\b(?:is\s+it|is\s+this|is\s+that)\s+(?:legal|illegal|against\s+the\s+law)\b",
    r"\b(?:bankrupt(?:cy)?|prenup(?:tial)?|alimony|eviction|foreclosure)\b",
]
_LEGAL_AR = [
    _ar(r"محام\w*|قانون\w*|مقاضا\w*|اقاضي|دعو(?:ى|ي)\s+قضائي\w*|افلاس\w*"),
]

_CREDIT_PRODUCTS_EN = (
    r"(?:credit\s+cards?|loans?|personal\s+loans?|mortgages?|mortgage\s+rates?|lenders?"
    r"|banks?|brokers?|brokerages?|savings\s+accounts?|insurance(?:\s+polic(?:y|ies))?"
    r"|insurers?|robo[-\s]?advisors?|trading\s+apps?|investing\s+apps?)"
)
_CREDIT_EN = [
    rf"\b(?:best|top|good|cheapest|recommended|right)\s+{_CREDIT_PRODUCTS_EN}\b",
    r"\bwhich\s+(?:credit\s+card|loan|mortgage|lender|bank|broker|insurance|insurer"
    r"|savings\s+account)\s+(?:should|would|could)\s+(?:i|we)\s+(?:get|open|choose|pick"
    r"|use|apply|sign\s+up)\b",
    rf"\brecommend\s+(?:me\s+)?(?:a\s+|an\s+|some\s+|any\s+)?(?:good\s+)?{_CREDIT_PRODUCTS_EN}\b",
    r"\b(?:apply|applying|qualify|approved)\s+for\s+(?:a\s+|an\s+|another\s+)?(?:new\s+)?"
    r"(?:credit\s+card|loan|mortgage|line\s+of\s+credit|heloc)\b",
    r"\bshould\s+(?:i|we)\s+(?:get|take|take\s+out|open|sign\s+up\s+for)\s+(?:a\s+|an\s+"
    r"|another\s+)?(?:new\s+)?(?:credit\s+card|loan|personal\s+loan|payday\s+loan|mortgage"
    r"|line\s+of\s+credit|heloc|balance\s+transfer)\b",
    r"\bcredit\s+(?:scores?|reports?|rating|repair|history|limit\s+increase|builder)\b",
    r"\b(?:refinanc(?:e|ing)|balance\s+transfer\s+cards?|consolidation\s+loans?"
    r"|payday\s+loans?)\b",
]
_AR_PRODUCTS = r"(?:بطاق\w*|قرض|قروض|بنك|بنوك|مصرف|تمويل|تامين|وسيط|حساب\s+توفير|تطبيق)"
_CREDIT_AR = [
    _ar(rf"(?:افضل|احسن|انسب)\s+{_AR_PRODUCTS}"),
    _ar(rf"انصح\w*\s+(?:ب)?{_AR_PRODUCTS}"),
    _ar(rf"هل\s+(?:ي\w+\s+(?:ان\s+)?)?(?:اخذ|افتح|اطلب|احصل\s+علي)\s+{_AR_PRODUCTS}"),
    _ar(r"هل\s+(?:ي\w+\s+(?:ان\s+)?)?اقترض"),
    _ar(r"(?:تقييم|سجل|درج|جدار|تصنيف)\w*\s+(?:ال)?ائتمان\w*"),
    _ar(r"اعاد\w*\s+(?:ال)?تمويل"),
]

REQUEST_PATTERNS: list[tuple[Topic, re.Pattern[str]]] = [
    (Topic.CRYPTO, _compile([_CRYPTO_EN, *_CRYPTO_AR])),
    (Topic.SECURITIES, _compile(_SECURITIES_EN + _SECURITIES_AR)),
    (Topic.INVESTMENT, _compile(_INVESTMENT_EN + _INVESTMENT_AR)),
    (Topic.TAX, _compile(_TAX_EN + _TAX_AR)),
    (Topic.LEGAL, _compile(_LEGAL_EN + _LEGAL_AR)),
    (Topic.CREDIT, _compile(_CREDIT_EN + _CREDIT_AR)),
]

# Output filter: model text that names or pushes products, tickers or crypto.
OUTPUT_PATTERNS = _compile(
    [
        _CRYPTO_EN,
        *_CRYPTO_AR,
        r"\b(?:buy|buying|sell|selling|purchase)\s+(?:some\s+)?(?:shares|stocks?|bonds?|etfs?"
        r"|index\s+funds?|crypto\w*)\b",
        r"\binvest(?:ing)?\s+(?:it\s+|them\s+|this\s+)?in\s+(?:stocks?|shares|bonds?|funds?"
        r"|etfs?|gold|real\s+estate)\b",
        r"\b(?:index|mutual)\s+funds?\b|\betfs?\b",
        r"\b(?:i|we)\s+(?:would\s+)?(?:recommend|suggest)\s+(?:opening|getting|applying\s+for"
        r"|using|buying|investing|the|a|an)\b[^.\n]{0,60}?\b(?:credit\s+card|loan|fund|broker"
        r"|bank|app|insurance|stock|mortgage)s?\b",
        *_SECURITIES_AR,
        _ar(r"استثمر\w*\s+في"),
    ]
)
# Tickers are matched on the original text because they are upper case.
TICKER_PATTERN = re.compile(
    r"\$[A-Z]{1,5}\b|\((?:NYSE|NASDAQ|LSE|TADAWUL)\s*:\s*[A-Z.]{1,6}\)|\b(?:NYSE|NASDAQ):\s*[A-Z]"
)
