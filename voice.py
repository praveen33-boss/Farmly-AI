import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sarvamai import SarvamAI

load_dotenv()

router = APIRouter(prefix="/voice", tags=["Voice"])

LANGUAGES = {
    "Telugu": "te-IN",
    "తెలుగు": "te-IN",
    "Hindi": "hi-IN",
    "हिंदी": "hi-IN",
    "English": "en-IN",
    "Marathi": "mr-IN",
    "मराठी": "mr-IN",
    "Tamil": "ta-IN",
    "தமிழ்": "ta-IN",
    "Punjabi": "pa-IN",
    "ਪੰਜਾਬੀ": "pa-IN",
}

SPEAKERS = {
    "te-IN": "kavitha",
    "hi-IN": "shubh",
    "en-IN": "shubh",
    "mr-IN": "shubh",
    "ta-IN": "shubh",
    "pa-IN": "shubh",
}


def get_sarvam_client() -> SarvamAI:
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Sarvam is not configured. Add SARVAM_API_KEY to the backend .env file.",
        )
    return SarvamAI(api_subscription_key=api_key)


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3500)
    language: str = "Telugu"


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = "Telugu",
):
    language_code = LANGUAGES.get(language)
    if not language_code:
        raise HTTPException(status_code=400, detail="Unsupported language.")

    allowed_types = {
        "audio/webm": ".webm",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/ogg": ".ogg",
    }
    content_type = (audio.content_type or "").split(";")[0].lower()
    suffix = allowed_types.get(content_type)
    if not suffix:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format. Use webm, wav, mp3, mp4, or ogg.",
        )

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded audio is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file must be 10 MB or smaller.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
            temp.write(content)
            temp_path = temp.name

        client = get_sarvam_client()
        with open(temp_path, "rb") as audio_file:
            result = client.speech_to_text.transcribe(
                file=audio_file,
                model="saaras:v4",
                language_code=language_code,
                mode="transcribe",
            )
        return {"transcript": result.transcript, "language": language}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Speech transcription failed. Check the Sarvam API key and audio format.",
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            Path(temp_path).unlink(missing_ok=True)


@router.post("/speak")
def text_to_speech(request: SpeechRequest):
    language_code = LANGUAGES.get(request.language)
    if not language_code:
        raise HTTPException(status_code=400, detail="Unsupported language.")

    try:
        client = get_sarvam_client()
        chunks = client.text_to_speech.convert_stream(
            text=request.text,
            model="bulbul:v3",
            language_code=language_code,
            speaker=SPEAKERS.get(language_code, "shubh"),
            output_audio_codec="mp3",
        )
        audio_data = b"".join(chunks)
        if not audio_data:
            raise ValueError("Sarvam returned empty audio.")
        return Response(content=audio_data, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Speech generation failed. Check the Sarvam SDK version, API key, and voice settings.",
        )
