from moneyflow_api.schemas.common import CategoryId, Locale

CATEGORY_LABELS: dict[Locale, dict[CategoryId, str]] = {
    "en": {
        "housing": "Housing",
        "utilities": "Utilities",
        "groceries": "Groceries",
        "transport": "Transport",
        "health": "Health",
        "insurance": "Insurance",
        "education": "Education",
        "debt": "Debt payments",
        "dining": "Dining out",
        "shopping": "Shopping",
        "entertainment": "Entertainment",
        "travel": "Travel",
        "subscriptions": "Subscriptions",
        "personal": "Personal care",
        "gifts": "Gifts",
        "savings": "Savings",
        "income": "Income",
        "other": "Other",
    },
    "ar": {
        "housing": "السكن",
        "utilities": "الفواتير والخدمات",
        "groceries": "البقالة",
        "transport": "المواصلات",
        "health": "الصحة",
        "insurance": "التأمين",
        "education": "التعليم",
        "debt": "سداد الديون",
        "dining": "المطاعم",
        "shopping": "التسوق",
        "entertainment": "الترفيه",
        "travel": "السفر",
        "subscriptions": "الاشتراكات",
        "personal": "العناية الشخصية",
        "gifts": "الهدايا",
        "savings": "الادخار",
        "income": "الدخل",
        "other": "أخرى",
    },
}

MONTH_NAMES: dict[Locale, list[str]] = {
    "en": [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ],
    "ar": [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    ],
}  # fmt: skip


def month_label(month_key: str, locale: Locale) -> str:
    """Format a month key for people, e.g. 2026-10 becomes October 2026."""
    year, month = month_key.split("-")
    return f"{MONTH_NAMES[locale][int(month) - 1]} {year}"
