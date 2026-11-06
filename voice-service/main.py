from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from voice import router

app = FastAPI(title="Farmly Voice Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # add the Vercel URL later
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def health():
    return {"status": "ok", "service": "voice"}