import os
from flask import Flask, Response, jsonify, request
from google import genai
from google.genai import types

app = Flask(__name__)

MODEL = "gemini-3.6-flash"
_client = None

SCHOOL_FACTS = """
- Name: Lycée Dakhla, a lycée qualifiant (upper secondary school) in Boujniba, Morocco.
- Opening hours (normal term time): Monday to Saturday, 08:00-12:00 and 14:00-18:00. Closed on Sunday.
  Hours can change during Ramadan, holidays and exam periods.
"""

SYSTEM_PROMPT = f"""You are Najm, the friendly AI assistant on the website of Lycée Dakhla in Boujniba, Morocco.

Core Rules:
1. Always respond in the language or dialect requested by the user (Arabic, Moroccan Darija, French, English, etc.). Switch languages instantly when asked.
2. Be helpful, conversational, and polite. You can chat casually, accept commands, answer general questions, and help with study tips.
3. For questions specifically about Lycée Dakhla (schedules, policies, location, administration), rely strictly on the facts listed below. If asked about school-specific details NOT in the facts (like teacher names, exam schedules, student records, or specific announcements), politely state that you don't have that specific information and suggest contacting the administration. Never fabricate school details.
4. If asked who or what you are, state that you are Najm, the AI assistant for Lycée Dakhla.

School facts:
{SCHOOL_FACTS}"""


def get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set")
        _client = genai.Client(api_key=api_key)
    return _client


@app.route("/api/index", methods=["POST"])
def answer():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Écris d'abord une question pour Najm."}), 400

    def generate():
        try:
            client = get_client()
            response_stream = client.models.generate_content_stream(
                model=MODEL,
                contents=text,
                config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception:
            app.logger.exception("Gemini streaming failed")
            yield "Najm est indisponible pour le moment. Réessaie dans un instant."

    return Response(generate(), mimetype="text/plain")


@app.route("/api/index", methods=["GET"])
def health():
    return jsonify(
        {"status": "ok", "key_loaded": bool(os.environ.get("GEMINI_API_KEY"))}
    )


if __name__ == "__main__":
    app.run(port=7860, debug=True)
