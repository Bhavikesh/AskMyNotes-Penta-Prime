from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from uuid import UUID
from datetime import date


# ── Query ────────────────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class AskMyNotesQueryRequest(BaseModel):
    user_id: UUID = Field(..., description="User UUID")
    subject_id: UUID = Field(..., description="Subject UUID to scope search")
    question: str = Field(..., min_length=3, description="Question to ask")
    conversation_history: List[ConversationTurn] = Field(
        default=[], description="Previous conversation turns for multi-turn context"
    )
    voice_mode: bool = Field(default=False, description="If true, optimize for fast voice responses")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "subject_id": "aabbccdd-1234-5678-abcd-ef0123456789",
                "question": "What is a deadlock?"
            }
        }


class Citation(BaseModel):
    file: str
    page: Optional[int] = None
    chunk_id: int


class AskMyNotesQueryResponse(BaseModel):
    answer: str
    confidence: Literal["High", "Medium", "Low", "Not Found"]
    citations: List[Citation] = []
    evidence: List[str] = []
    follow_up_question: Optional[str] = None  # Set in voice_mode

    class Config:
        json_schema_extra = {
            "example": {
                "answer": "Deadlock occurs when processes wait indefinitely...",
                "confidence": "High",
                "follow_up_question": "Can you name the four conditions for deadlock?",
                "citations": [{"file": "OS.pdf", "page": 12, "chunk_id": 45}],
                "evidence": ["Deadlock occurs when processes wait indefinitely for resources held by each other."]
            }
        }


# ── Study Mode ───────────────────────────────────────────────────────────────

class StudyModeRequest(BaseModel):
    user_id: UUID = Field(..., description="User UUID")
    subject_id: UUID = Field(..., description="Subject UUID to generate questions for")


class MCQOption(BaseModel):
    A: str
    B: str
    C: str
    D: str


class MCQ(BaseModel):
    question: str
    options: MCQOption
    correct_answer: Literal["A", "B", "C", "D"]
    citations: List[Citation] = []
    evidence: List[str] = []


class ShortAnswerQ(BaseModel):
    question: str
    answer: str
    citations: List[Citation] = []
    evidence: List[str] = []


class StudyModeResponse(BaseModel):
    subject: str
    mcqs: List[MCQ]
    short_answers: List[ShortAnswerQ]


# ── Analytics ─────────────────────────────────────────────────────────────────

class SubjectAnalytics(BaseModel):
    subject: str
    accuracy: float = Field(..., description="Accuracy percentage (0-100)")
    questions_attempted: int
    average_confidence: float = Field(..., description="Average confidence score 0-1")


class TimelinePoint(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    accuracy: float


class AnalyticsResponse(BaseModel):
    subjects: List[SubjectAnalytics]
    timeline: List[TimelinePoint]


# ── SAQ Evaluation ───────────────────────────────────────────────────────────

class SAQAnswerItem(BaseModel):
    question: str
    user_answer: str
    correct_answer: str

class SAQEvaluationRequest(BaseModel):
    user_id: UUID
    subject_id: UUID
    answers: List[SAQAnswerItem]

class SAQEvalResult(BaseModel):
    question: str
    user_answer: str
    correct_answer: str
    verdict: Literal["Correct", "Partially Correct", "Incorrect"]
    score: float = Field(..., description="0.0 to 1.0")
    feedback: str = ""

class SAQEvaluationResponse(BaseModel):
    results: List[SAQEvalResult]
    total_score: float
    max_score: float
