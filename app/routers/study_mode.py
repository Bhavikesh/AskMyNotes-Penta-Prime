"""
Router: /study-mode — generate MCQs and short-answer questions from subject notes.
"""
import json
from fastapi import APIRouter, HTTPException
from app.models.askmynotes_models import (
    StudyModeRequest, StudyModeResponse,
    SAQEvaluationRequest, SAQEvaluationResponse, SAQEvalResult,
)
from app.services.study_mode_service import StudyModeService
from app.services.subject_manager import SubjectManager
from app.config import get_settings
from groq import AsyncGroq

router = APIRouter()
study_svc = StudyModeService()
subject_mgr = SubjectManager()
settings = get_settings()


@router.post("/", response_model=StudyModeResponse, summary="Generate study questions for a subject")
async def study_mode(payload: StudyModeRequest):
    """
    Generate 5 MCQs and 3 Short Answer Questions grounded in the subject's notes.
    Each question includes citations and evidence snippets.
    """
    # Validate subject ownership
    subject_row = await subject_mgr.get_subject(str(payload.user_id), str(payload.subject_id))
    subject_name = subject_row["name"]

    try:
        result = await study_svc.generate(
            user_id=str(payload.user_id),
            subject_id=str(payload.subject_id),
            subject_name=subject_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Study mode generation failed: {str(e)}")

    return result


@router.post("/evaluate", response_model=SAQEvaluationResponse, summary="Evaluate short answer responses")
async def evaluate_answers(payload: SAQEvaluationRequest):
    """
    Compare user's short answers against correct answers using LLM.
    Returns verdict (Correct / Partially Correct / Incorrect), score, and feedback.
    """
    if not payload.answers:
        return SAQEvaluationResponse(results=[], total_score=0, max_score=0)

    # Build prompt for LLM evaluation
    items = []
    for i, a in enumerate(payload.answers):
        items.append(
            f"Q{i+1}: {a.question}\n"
            f"Correct Answer: {a.correct_answer}\n"
            f"Student Answer: {a.user_answer}"
        )

    prompt = (
        "You are a strict but fair exam evaluator. Compare each student answer "
        "against the correct answer. For each question, output:\n"
        '- verdict: "Correct", "Partially Correct", or "Incorrect"\n'
        "- score: 1.0 for Correct, 0.5 for Partially Correct, 0.0 for Incorrect\n"
        "- feedback: brief explanation of why\n\n"
        + "\n\n".join(items) + "\n\n"
        "Output STRICT JSON array (no markdown):\n"
        '[{"verdict": "...", "score": ..., "feedback": "..."}]'
    )

    try:
        groq = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await groq.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are an exam evaluator. Output only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("```").strip()

        evaluations = json.loads(raw)
    except Exception as e:
        # Fallback: simple keyword matching
        evaluations = []
        for a in payload.answers:
            user_lower = a.user_answer.lower().strip()
            correct_lower = a.correct_answer.lower().strip()
            if user_lower == correct_lower or correct_lower in user_lower:
                evaluations.append({"verdict": "Correct", "score": 1.0, "feedback": "Matches expected answer"})
            elif any(word in user_lower for word in correct_lower.split()[:3]):
                evaluations.append({"verdict": "Partially Correct", "score": 0.5, "feedback": "Contains some key concepts"})
            else:
                evaluations.append({"verdict": "Incorrect", "score": 0.0, "feedback": "Does not match expected answer"})

    results = []
    for i, a in enumerate(payload.answers):
        ev = evaluations[i] if i < len(evaluations) else {"verdict": "Incorrect", "score": 0.0, "feedback": ""}
        results.append(SAQEvalResult(
            question=a.question,
            user_answer=a.user_answer,
            correct_answer=a.correct_answer,
            verdict=ev.get("verdict", "Incorrect"),
            score=ev.get("score", 0.0),
            feedback=ev.get("feedback", ""),
        ))

    total = sum(r.score for r in results)
    
    # Log the actual test score to study_sessions for analytics
    from app.services.supabase_service import SupabaseService
    db = SupabaseService()
    db.log_study_session(
        user_id=str(payload.user_id),
        subject_id=str(payload.subject_id),
        score=int(total),
        total_questions=len(results),
    )
    
    return SAQEvaluationResponse(results=results, total_score=total, max_score=len(results))
