"""Convert contract chat messages into Gemini `contents`."""

from moneyflow_api.ai.gemini_format import (
    JsonObject,
    function_response,
    model_function_call,
    model_text,
    user_text,
)
from moneyflow_api.ai.prompts import user_message
from moneyflow_api.schemas.coach import (
    AssistantTextMessage,
    AssistantToolCallMessage,
    ChatMessage,
    ToolMessage,
    UserMessage,
)


def build_contents(messages: list[ChatMessage]) -> list[JsonObject]:
    """Map roles: user -> user, assistant -> model, tool result -> user functionResponse.

    Tool calls the web app never answered are skipped (Gemini expects every
    functionCall to be followed by its functionResponse), and leading model turns
    are dropped so the conversation starts with the user.
    """
    answered = {m.toolResult.id for m in messages if isinstance(m, ToolMessage)}
    contents: list[JsonObject] = []
    for message in messages:
        if isinstance(message, UserMessage):
            contents.append(user_text(user_message(message.text)))
        elif isinstance(message, AssistantTextMessage):
            contents.append(model_text(message.text))
        elif isinstance(message, AssistantToolCallMessage):
            call = message.toolCall
            if call.id in answered:
                contents.append(model_function_call(call.name, call.args))
        else:
            result = message.toolResult
            contents.append(function_response(result.name, result.result))
    while contents and contents[0]["role"] == "model":
        contents.pop(0)
    return contents
