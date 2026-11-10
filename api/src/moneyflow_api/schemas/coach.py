from typing import Annotated, Any, Literal, Self

from pydantic import Discriminator, Field, StringConstraints, Tag, model_validator

from moneyflow_api.schemas.common import (
    CategoryAmount,
    CurrencyCode,
    DateKey,
    DisplayName,
    Identifier,
    JsonObject,
    Locale,
    Minor,
    MonthKey,
    Ratio,
    RequestModel,
    ResponseModel,
    Source,
    ensure_unique,
)

ToolName = Literal[
    "check_affordability", "simulate_scenario", "project_goal", "compare_debt_strategies"
]  # fmt: skip

TEXT_MAX = 2000
ChatText = Annotated[str, StringConstraints(min_length=1, max_length=TEXT_MAX)]


class CoachGoal(RequestModel):
    id: Identifier
    name: DisplayName
    target: Minor
    saved: Minor
    targetDate: DateKey | None = None
    projectedMonth: MonthKey | None = None


class CoachDebt(RequestModel):
    id: Identifier
    name: DisplayName
    balance: Minor
    aprBps: int = Field(ge=0, le=100_000)
    minPayment: Minor


class CoachContext(RequestModel):
    month: MonthKey
    monthlyIncome: Minor
    monthlySpending: Minor
    savingsRate: Ratio
    savingsBalance: Minor
    emergencyFund: Minor
    emergencyMonths: float = Field(ge=0, le=1000, allow_inf_nan=False)
    healthScore: int | None = Field(default=None, ge=0, le=100)
    categories: list[CategoryAmount] = Field(default_factory=list, max_length=18)
    goals: list[CoachGoal] = Field(default_factory=list, max_length=10)
    debts: list[CoachDebt] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _unique_ids(self) -> Self:
        ensure_unique((c.categoryId for c in self.categories), "categoryId")
        ensure_unique((g.id for g in self.goals), "goal id")
        ensure_unique((d.id for d in self.debts), "debt id")
        return self


class ToolCall(RequestModel):
    id: Identifier
    name: ToolName
    args: JsonObject


class ToolResult(RequestModel):
    id: Identifier
    name: ToolName
    result: JsonObject


class UserMessage(RequestModel):
    role: Literal["user"]
    text: ChatText


class AssistantTextMessage(RequestModel):
    role: Literal["assistant"]
    text: ChatText


class AssistantToolCallMessage(RequestModel):
    role: Literal["assistant"]
    toolCall: ToolCall


class ToolMessage(RequestModel):
    role: Literal["tool"]
    toolResult: ToolResult


def _message_kind(value: Any) -> str | None:
    if isinstance(value, dict):
        role, has_tool_call = value.get("role"), "toolCall" in value
    else:
        role, has_tool_call = getattr(value, "role", None), hasattr(value, "toolCall")
    if role == "assistant":
        return "assistant_tool_call" if has_tool_call else "assistant_text"
    return role if role in ("user", "tool") else None


ChatMessage = Annotated[
    Annotated[UserMessage, Tag("user")]
    | Annotated[AssistantTextMessage, Tag("assistant_text")]
    | Annotated[AssistantToolCallMessage, Tag("assistant_tool_call")]
    | Annotated[ToolMessage, Tag("tool")],
    Discriminator(_message_kind),
]


class CoachRequest(RequestModel):
    locale: Locale
    currency: CurrencyCode
    context: CoachContext
    messages: list[ChatMessage] = Field(min_length=1, max_length=24)

    @model_validator(mode="after")
    def _valid_sequence(self) -> Self:
        if not isinstance(self.messages[-1], UserMessage | ToolMessage):
            raise ValueError("the last message must have role user or tool")
        for index, message in enumerate(self.messages):
            if isinstance(message, ToolMessage):
                previous = self.messages[index - 1] if index > 0 else None
                if not (
                    isinstance(previous, AssistantToolCallMessage)
                    and previous.toolCall.id == message.toolResult.id
                    and previous.toolCall.name == message.toolResult.name
                ):
                    raise ValueError(
                        f"messages[{index}]: a tool message must directly follow the "
                        "assistant toolCall with the same id and name"
                    )
        return self

    @property
    def ends_with_user_text(self) -> bool:
        return isinstance(self.messages[-1], UserMessage)

    @property
    def latest_user_text(self) -> str | None:
        last = self.messages[-1]
        return last.text if isinstance(last, UserMessage) else None


class CoachToolCall(ResponseModel):
    id: str
    name: ToolName
    args: dict[str, Any]


class CoachMessageResponse(ResponseModel):
    type: Literal["message"] = "message"
    text: ChatText
    refusal: bool
    source: Source


class CoachToolCallResponse(ResponseModel):
    type: Literal["tool_call"] = "tool_call"
    toolCall: CoachToolCall
    source: Source


CoachResponse = Annotated[CoachMessageResponse | CoachToolCallResponse, Field(discriminator="type")]
