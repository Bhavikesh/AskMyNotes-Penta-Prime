from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.routers import upload
from app.routers import subjects, askmynotes, study_mode, analytics, voice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = FastAPI(title="AskMyNotes API", version="2.0.0")

# CORS middleware
import os
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployed API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── AskMyNotes routes ─────────────────────────────────────────────────────────
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(subjects.router, prefix="/subjects", tags=["Subjects"])
app.include_router(askmynotes.router, prefix="/askmynotes", tags=["AskMyNotes"])
app.include_router(study_mode.router, prefix="/study-mode", tags=["Study Mode"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(voice.router, prefix="/voice", tags=["Voice Teacher"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "AskMyNotes API", "version": "2.0.0"}


@app.get("/")
async def root():
    return {"message": "AskMyNotes API", "docs": "/docs"}
