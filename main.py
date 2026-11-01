import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from assistant import router as assistant_router
from voice import router as voice_router

app = FastAPI(
    title="Farmly AI API",
    description="Multilingual agricultural advisory backend for Farmly AI.",
    version="1.0.0",
)

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in frontend_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assistant_router, prefix="/api")
app.include_router(voice_router)


@app.get("/")
def home():
    return {"message": "Farmly AI backend is running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
