
import os
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
from sarvamai import SarvamAI

load_dotenv()

router = APIRouter(prefix="/voice", tags=["Voice"])

client = SarvamAI(
    api_subscription_key=os.environ["SARVAM_API_KEY"]
)

LANGUAGES = {
    "Telugu": "te-IN",
    "Hindi": "hi-IN",
    "English": "en-IN"
}


class SpeechRequest(BaseModel):
    text: str
    language: str = "Telugu"


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...),
                           language: str = "Telugu"):

    if language not in LANGUAGES:
        raise HTTPException(400, "Unsupported language")

    if audio.content_type not in [
        "audio/webm", "audio/wav", "audio/mpeg",
        "audio/mp4", "audio/ogg"
    ]:
        raise HTTPException(400, "Unsupported audio format")

    content = await audio.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Audio file too large")

    suffix = ".webm"
    if audio.content_type == "audio/wav":
        suffix = ".wav"
    elif audio.content_type in ["audio/mp4"]:
        suffix = ".m4a"
    elif audio.content_type == "audio/mpeg":
        suffix = ".mp3"
    elif audio.content_type == "audio/ogg":
        suffix = ".ogg"

    path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False
        ) as temp:
            temp.write(content)
            path = temp.name

        with open(path, "rb") as f:
            result = client.speech_to_text.transcribe(
                file=f,
                model="saaras:v4",
                language_code=LANGUAGES[language],
                mode="transcribe"
            )

        return {
            "transcript": result.transcript,
            "language": language
        }

    except Exception as e:
        raise HTTPException(502, f"Transcription failed: {e}")

    finally:
        if path and os.path.exists(path):
            os.remove(path)


@router.post("/speak")
def text_to_speech(request: SpeechRequest):

    if request.language not in LANGUAGES:
        raise HTTPException(400, "Unsupported language")

    try:
        chunks = client.text_to_speech.convert_stream(
            text=request.text,
            model="bulbul:v4-flash",
            target_language_code=LANGUAGES[request.language],
            speaker="kavitha" if request.language == "Telugu" else "shubh",
            output_audio_codec="mp3"
        )

        audio_data = b"".join(chunks)

        return Response(
            content=audio_data,
            media_type="audio/mpeg"
        )

    except Exception as e:
        raise HTTPException(502, f"Speech generation failed: {e}")
