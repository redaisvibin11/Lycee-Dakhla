lazy import os
lazy from fastapi import APIRouter, HTTPException
lazy from fastapi.responses import StreamingResponse
lazy from pydantic import BaseModel
lazy from google import genai
lazy from google.genai import types
lazy import db

router = APIRouter(prefix="/api", tags=["Najm AI"])


class ChatRequest(BaseModel):
    text: str


@router.post("/index")
def answer(payload: ChatRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Invalid input")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key provided")
    client = genai.Client(api_key=api_key)

    announcements = db.get_announcements(limit=10)
    projects = db.get_projects(limit=10)
    scheds = db.get_sched(limit=10)

    ann_text = (
        "\n".join(
            [
                f"- [{a["created_at"]}] {a["title"]}: {a["content"]}"
                for a in announcements
            ]
        )
        if announcements
        else "aucune annonce recente"
    )
    sched_text = (
        "\n".join([f" - {s['title']} (classe: {s['class_']})" for s in scheds])
        if scheds
        else "acune emploi du temps disponible"
    )
    proj_text = (
        "\n".join(
            [
                f" - {p["title"]} par {p["student_name"]}: {p["description"]}"
                for p in projects
            ]
        )
        if projects
        else "aucune projet recent"
    )
    system_prompt = f"""You are Najm, the AI assistant for Lycée Dakhla in Boujniba, Morocco. 
    Your creator and developer is Reda. He is a student in TCSF1 if asked.

    CRITICAL RULES:
    1. NEVER greet the user (e.g., do not say "Hello", "Hi", "Welcome") unless it is the very first message of a brand new session. Get straight to the point.
    2. If asked who created you, built you, or programmed you, always state that you were created by Reda.
    3. **TEACHER ABSENCE CHECK:** When users ask if any teachers are absent, scan the official announcements below for keywords like "absence", "professeur", "تغيب", "استاذ", "grève", "remplaçant", or canceled classes. Summarize which teacher is absent and any instructions provided.
    4. You can control the UI when requested by appending action tags to your response:
    - [ACTION:THEME:DARK] / [ACTION:THEME:LIGHT]
    - [ACTION:LANG:AR] / [ACTION:LANG:FR] / [ACTION:LANG:EN]
    5. Reply appropriately and professionally to every prompt.

    --- LIVE DATABASE CONTEXT ---
    [الإعلانات الرسمية / Official Announcements]:
    {ann_text}

    [جداول الحصص / Schedules]:
    {sched_text}

    [مشاريع التلاميذ / Student Projects]:
    {proj_text}
    ----------------------------
    """

    def generate():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=text,
                config=types.GenerateContentConfig(system_instruction=system_prompt),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception:
            yield "Najm"

    return StreamingResponse(generate(), media_type="text/plain")
