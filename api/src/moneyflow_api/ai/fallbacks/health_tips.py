from moneyflow_api.ai.text import clip
from moneyflow_api.schemas.common import Locale
from moneyflow_api.schemas.health_tips import (
    TIP_MAX_CHARS,
    FactorId,
    FactorStatus,
    HealthTip,
    HealthTipsRequest,
    HealthTipsResponse,
)

_TIPS: dict[Locale, dict[FactorId, dict[FactorStatus, str]]] = {
    "en": {
        "savingsRate": {
            "good": "You are saving a healthy share of your income. Keep the savings transfer "
            "automatic right after payday so it stays effortless. Healthy range: {healthy}.",
            "fair": "You are saving, which is a great start. Raise your automatic savings "
            "transfer a little at a time until you reach the healthy range: {healthy}.",
            "poor": "Saving is tight right now. Start small: set aside a fixed amount right "
            "after payday and trim one flexible category. Healthy range: {healthy}.",
            "unknown": "Add this month's income and spending so Moneyflow can measure your "
            "savings rate.",
        },
        "emergencyFund": {
            "good": "Your emergency fund is a solid cushion. Keep it separate from everyday "
            "money and top it up after you use it. Healthy level: {healthy}.",
            "fair": "You have started an emergency fund. Keep adding a fixed amount each month "
            "until it reaches the healthy level: {healthy}.",
            "poor": "Your emergency cushion is thin. A small automatic transfer every week "
            "builds it steadily. Healthy level: {healthy}.",
            "unknown": "Add your savings and essential spending so Moneyflow can measure your "
            "emergency fund.",
        },
        "debtToIncome": {
            "good": "Your debt payments are a manageable share of your income. Keep paying on "
            "time and avoid adding new balances. Healthy range: {healthy}.",
            "fair": "Debt payments take a noticeable share of your income. Putting a little "
            "extra on one debt at a time speeds things up. Healthy range: {healthy}.",
            "poor": "Debt payments take a large share of your income. Compare payoff "
            "strategies in the simulator to pick a plan you can stick to. Healthy range: "
            "{healthy}.",
            "unknown": "Add your debts and income so Moneyflow can measure your debt load.",
        },
        "fixedCosts": {
            "good": "Your fixed costs leave room to breathe. Review bills and subscriptions "
            "once a year to keep it that way. Healthy range: {healthy}.",
            "fair": "Fixed costs take a sizable share of your income. Check bills and "
            "subscriptions for anything you can renegotiate or cancel. Healthy range: "
            "{healthy}.",
            "poor": "Fixed costs take most of your income, leaving little room for surprises. "
            "Start with the largest bill and look for a way to lower it. Healthy range: "
            "{healthy}.",
            "unknown": "Add your bills and income so Moneyflow can measure your fixed costs.",
        },
    },
    "ar": {
        "savingsRate": {
            "good": "أنت تدّخر نسبة جيدة من دخلك. اجعل تحويل الادخار تلقائيًا بعد استلام "
            "الراتب مباشرة ليبقى سهلًا. النطاق الصحي: {healthy}.",
            "fair": "أنت تدّخر، وهذه بداية رائعة. زِد تحويل الادخار التلقائي قليلًا في كل مرة "
            "حتى تصل إلى النطاق الصحي: {healthy}.",
            "poor": "الادخار صعب حاليًا. ابدأ بخطوة صغيرة: خصّص مبلغًا ثابتًا بعد الراتب "
            "مباشرة وقلّل فئة مرنة واحدة. النطاق الصحي: {healthy}.",
            "unknown": "أضف دخل هذا الشهر ومصاريفه ليتمكن Moneyflow من قياس نسبة ادخارك.",
        },
        "emergencyFund": {
            "good": "صندوق الطوارئ لديك وسادة أمان جيدة. احتفظ به منفصلًا عن مصروفك اليومي "
            "وأعد تعبئته بعد استخدامه. المستوى الصحي: {healthy}.",
            "fair": "لقد بدأت صندوق طوارئ. استمر في إضافة مبلغ ثابت كل شهر حتى يصل إلى "
            "المستوى الصحي: {healthy}.",
            "poor": "وسادة الطوارئ لديك رقيقة. تحويل تلقائي صغير كل أسبوع يبنيها بثبات. "
            "المستوى الصحي: {healthy}.",
            "unknown": "أضف مدخراتك ومصاريفك الأساسية ليتمكن Moneyflow من قياس صندوق الطوارئ.",
        },
        "debtToIncome": {
            "good": "أقساط ديونك نسبة يمكن التحكم بها من دخلك. استمر في السداد في الموعد "
            "وتجنب إضافة أرصدة جديدة. النطاق الصحي: {healthy}.",
            "fair": "أقساط الديون تأخذ نسبة ملحوظة من دخلك. دفع مبلغ إضافي صغير على دين واحد "
            "في كل مرة يسرّع السداد. النطاق الصحي: {healthy}.",
            "poor": "أقساط الديون تأخذ نسبة كبيرة من دخلك. قارن خطط السداد في المحاكي لتختار "
            "خطة تستطيع الالتزام بها. النطاق الصحي: {healthy}.",
            "unknown": "أضف ديونك ودخلك ليتمكن Moneyflow من قياس عبء الديون.",
        },
        "fixedCosts": {
            "good": "تكاليفك الثابتة تترك لك مساحة مريحة. راجع الفواتير والاشتراكات مرة في "
            "السنة لتحافظ على ذلك. النطاق الصحي: {healthy}.",
            "fair": "التكاليف الثابتة تأخذ نسبة كبيرة من دخلك. راجع الفواتير والاشتراكات بحثًا "
            "عما يمكن تخفيضه أو إلغاؤه. النطاق الصحي: {healthy}.",
            "poor": "التكاليف الثابتة تستهلك معظم دخلك ولا تترك مجالًا للمفاجآت. ابدأ بأكبر "
            "فاتورة وابحث عن طريقة لتخفيضها. النطاق الصحي: {healthy}.",
            "unknown": "أضف فواتيرك ودخلك ليتمكن Moneyflow من قياس التكاليف الثابتة.",
        },
    },
}


def health_tips_fallback(request: HealthTipsRequest) -> HealthTipsResponse:
    tips = [
        HealthTip(
            factorId=factor.id,
            text=clip(
                _TIPS[request.locale][factor.id][factor.status].format(healthy=factor.healthy),
                TIP_MAX_CHARS,
            ),
        )
        for factor in request.factors
    ]
    return HealthTipsResponse(tips=tips, source="fallback")
