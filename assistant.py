import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from groq import Groq
from pydantic import BaseModel, Field

load_dotenv()

router = APIRouter(tags=["Agricultural assistant"])

LANGUAGES = {
    "English": "English",
    "Hindi": "Hindi",
    "हिंदी": "Hindi",
    "Telugu": "Telugu",
    "తెలుగు": "Telugu",
    "Marathi": "Marathi",
    "मराठी": "Marathi",
    "Tamil": "Tamil",
    "தமிழ்": "Tamil",
    "Punjabi": "Punjabi",
    "ਪੰਜਾਬੀ": "Punjabi",
}

SYSTEM_PROMPT = """You are Farmly AI, a careful and farmer-friendly agricultural assistant for India.
Give practical, simple, step-by-step advice. Use the farmer's requested language.
Do not pretend to have live weather, mandi prices, government scheme status, or access to the farmer's field.
Never invent pesticide/fertilizer doses, prices, forecasts, eligibility, or official rules.
For crop disease questions, ask for the crop, growth stage, symptoms, and (if useful) a clear photo before suggesting a treatment.
For chemical inputs, advise following the product label and local agricultural officer/KVK guidance; do not guess a dose.
If important details are missing, ask one or two focused questions.
Be concise and easy to understand. Avoid overly technical terms.
Return exactly two sections:
ANSWER: [answer in the requested language]
ENGLISH_TRANSLATION: [a faithful English translation; if requested language is English, repeat the answer]
"""


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=4000)
    language: str = "English"
    crop: str | None = None
    location: str | None = None
    soil: str | None = None
    irrigation: str | None = None


class ChatResponse(BaseModel):
    answer: str
    english_translation: str
    language: str


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Groq is not configured. Add GROQ_API_KEY to the backend .env file.",
        )

    language = LANGUAGES.get(request.language, request.language)
    model = os.getenv("GROQ_MODEL") or "openai/gpt-oss-120b"

    farm_context = (
        f"Farmer context: crop={request.crop or 'not provided'}; "
        f"location={request.location or 'not provided'}; "
        f"soil={request.soil or 'not provided'}; "
        f"irrigation={request.irrigation or 'not provided'}."
    )
    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Respond in {language}. {farm_context}\n"
                        f"Farmer's question: {request.message}"
                    ),
                },
            ],
            max_completion_tokens=700,
        )
        content = completion.choices[0].message.content or ""
        answer = content
        translation = ""
        if "ENGLISH_TRANSLATION:" in content:
            answer_part, translation_part = content.split("ENGLISH_TRANSLATION:", 1)
            answer = answer_part.replace("ANSWER:", "").strip()
            translation = translation_part.strip()
        else:
            answer = content.replace("ANSWER:", "").strip()
        if not translation:
            translation = answer if language == "English" else (
                "English translation was not returned. Please refer to the answer above."
            )
        return ChatResponse(
            answer=answer,
            english_translation=translation,
            language=language,
        )
    except HTTPException:
        raise
    except Exception:
        # Keep provider credentials and internal exception details out of API responses.
        raise HTTPException(
            status_code=502,
            detail="The AI service could not generate a response. Check your Groq API key, model name, and connection.",
        )
