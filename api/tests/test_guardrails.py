import pytest

from moneyflow_api.ai.guardrail_patterns import Topic
from moneyflow_api.ai.guardrails import (
    detect_restricted_topic,
    normalize,
    refusal_text,
    violates_output_policy,
)

REFUSED_EN = [
    ("Should I invest in Tesla stock?", Topic.SECURITIES),
    ("What stocks should I buy this year?", Topic.SECURITIES),
    ("Is $TSLA a good buy?", Topic.SECURITIES),
    ("should i buy shares of apple", Topic.SECURITIES),
    ("Is day trading a good side income?", Topic.SECURITIES),
    ("What dividend yield is good?", Topic.SECURITIES),
    ("Should I buy Bitcoin?", Topic.CRYPTO),
    ("is crypto a good idea for my savings", Topic.CRYPTO),
    ("what about ethereum or solana", Topic.CRYPTO),
    ("Should I buy an NFT?", Topic.CRYPTO),
    ("Where should I invest my savings?", Topic.INVESTMENT),
    ("How do I invest $5000?", Topic.INVESTMENT),
    ("Are index funds better than a savings account?", Topic.INVESTMENT),
    ("what are the best investments right now", Topic.INVESTMENT),
    ("Should I open a Roth IRA?", Topic.INVESTMENT),
    ("Give me investment advice", Topic.INVESTMENT),
    ("Should I invest in real estate?", Topic.INVESTMENT),
    ("How do I reduce my taxes?", Topic.TAX),
    ("Can you help with my tax return?", Topic.TAX),
    ("Is my laptop tax-deductible?", Topic.TAX),
    ("how do i pay less tax", Topic.TAX),
    ("What tax bracket am I in?", Topic.TAX),
    ("Do I need a lawyer for this?", Topic.LEGAL),
    ("Can I sue my landlord?", Topic.LEGAL),
    ("Is it legal to skip a payment?", Topic.LEGAL),
    ("Should I file for bankruptcy?", Topic.LEGAL),
    ("What's the best credit card for travel?", Topic.CREDIT),
    ("Which credit card should I get?", Topic.CREDIT),
    ("How can I improve my credit score?", Topic.CREDIT),
    ("Should I take out a personal loan?", Topic.CREDIT),
    ("Should I refinance my mortgage?", Topic.CREDIT),
    ("Can you recommend a bank?", Topic.CREDIT),
    ("Should I apply for a loan to buy a car?", Topic.CREDIT),
    ("Is a payday loan a good idea?", Topic.CREDIT),
]

REFUSED_AR = [
    ("هل أستثمر في الذهب؟", Topic.INVESTMENT),
    ("أين أستثمر مدخراتي؟", Topic.INVESTMENT),
    ("ما هي أفضل الاستثمارات؟", Topic.INVESTMENT),
    ("والاستثمار في الأسهم؟", Topic.SECURITIES),
    ("هل أشتري أسهم أرامكو؟", Topic.SECURITIES),
    ("ما رأيك في سوق الأسهم؟", Topic.SECURITIES),
    ("هل البورصة مناسبة لي؟", Topic.SECURITIES),
    ("هل أشتري بيتكوين؟", Topic.CRYPTO),
    ("ما رأيك في العملات الرقمية؟", Topic.CRYPTO),
    ("هل العملة المشفرة آمنة؟", Topic.CRYPTO),
    ("كيف أقلل الضرائب؟", Topic.TAX),
    ("هل يمكنك مساعدتي في الإقرار الضريبي؟", Topic.TAX),
    ("أحتاج محامي", Topic.LEGAL),
    ("هل هذا قانوني؟", Topic.LEGAL),
    ("هل أرفع دعوى قضائية على المالك؟", Topic.LEGAL),
    ("ما هي أفضل بطاقة ائتمان؟", Topic.CREDIT),
    ("هل آخذ قرض لشراء سيارة؟", Topic.CREDIT),
    ("كيف أحسن تقييمي الائتماني؟", Topic.CREDIT),
    ("انصحني ببنك جيد", Topic.CREDIT),
    ("هل أقترض من أجل الزفاف؟", Topic.CREDIT),
    ("هل أَسْتَثْمِرُ في الذهب؟", Topic.INVESTMENT),
]

ALLOWED = [
    "The taxi to work costs a lot every month",
    "How do I pay off my credit card faster?",
    "Which credit card should I pay off first?",
    "I'm investing time in budgeting this year",
    "Can I afford a phone in March?",
    "Can I afford a $900 phone?",
    "What share of my income goes to rent?",
    "I need to stock up on groceries",
    "Is the phone in stock anywhere cheaper?",
    "What is my after-tax income?",
    "My take-home pay is pre-tax 4200",
    "How fast can I reach my car goal?",
    "Should I cut dining out to save more?",
    "Compare snowball and avalanche for my debts",
    "How much should I keep in my emergency fund?",
    "What if I save 200 more each month?",
    "Can I pay my mortgage off sooner with extra payments?",
    "I want to build a savings habit",
    "Is my spending on subscriptions too high?",
    "تاكسي العمل مكلف كل شهر",
    "كيف أسدد بطاقة الائتمان بسرعة؟",
    "استثمار الوقت في الميزانية مهم",
    "هل أستطيع شراء هاتف في مارس؟",
    "كم دخلي بعد الضريبة؟",
    "ماذا لو ادخرت 200 إضافية كل شهر؟",
    "متى أصل إلى هدف السيارة؟",
    "هل أقلل مصاريف المطاعم؟",
    "كم يجب أن يكون صندوق الطوارئ؟",
]


@pytest.mark.parametrize(("text", "topic"), REFUSED_EN + REFUSED_AR)
def test_restricted_requests_are_detected(text: str, topic: Topic) -> None:
    assert detect_restricted_topic(text) == topic


@pytest.mark.parametrize("text", ALLOWED)
def test_budgeting_questions_are_not_refused(text: str) -> None:
    assert detect_restricted_topic(text) is None


def test_detection_is_case_and_width_insensitive() -> None:
    assert detect_restricted_topic("SHOULD I BUY BITCOIN") == Topic.CRYPTO
    assert detect_restricted_topic("".join(chr(ord(c) + 0xFEE0) for c in "bitcoin")) == Topic.CRYPTO


def test_normalize_strips_arabic_diacritics_and_unifies_letters() -> None:
    assert normalize("أَسْهُم") == "اسهم"
    assert normalize("إلى") == "الي"
    assert normalize("مـــال") == "مال"


@pytest.mark.parametrize(
    "text",
    [
        "You could buy some index funds with the extra money.",
        "Consider $AAPL for long-term growth.",
        "Apple (NASDAQ: AAPL) has done well.",
        "Putting a little into Bitcoin could help.",
        "I recommend opening a high-yield savings account at a bank.",
        "We suggest getting a balance transfer credit card.",
        "You might invest in stocks once your fund is ready.",
        "ETFs are a simple option.",
        "يمكنك شراء بعض الأسهم بالمبلغ الإضافي.",
        "العملات الرقمية خيار جيد.",
        "استثمر في الذهب.",
    ],
)
def test_output_filter_catches_product_and_crypto_mentions(text: str) -> None:
    assert violates_output_policy(text)


@pytest.mark.parametrize(
    "text",
    [
        "The simulator says you can afford the phone in March and still keep your buffer.",
        "Paying an extra 100 on the card with the highest rate saves the most interest.",
        "Your savings rate is 16.4%, which is close to the healthy range.",
        "Cutting dining by 10% would free up money for your car goal.",
        "حسب المحاكي، يمكنك شراء الهاتف في مارس.",
        "نسبة ادخارك 16.4%، وهي قريبة من النطاق الصحي.",
    ],
)
def test_output_filter_allows_budget_explanations(text: str) -> None:
    assert not violates_output_policy(text)


@pytest.mark.parametrize("topic", list(Topic))
def test_refusals_are_localized_and_explain_why(topic: Topic) -> None:
    english = refusal_text("en", topic)
    arabic = refusal_text("ar", topic)

    assert "educational budgeting tool" in english
    assert "qualified professional" in english
    assert "أداة تعليمية" in arabic
    assert english != arabic
    assert len(english) <= 2000
    assert len(arabic) <= 2000
