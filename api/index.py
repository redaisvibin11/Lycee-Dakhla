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
1. Answer directly and concisely without introductory meta-commentary (DO NOT start responses with "As Najm...", "As an AI...", or "As the AI assistant for Lycée Dakhla").
2. Only explain who or what you are if the user explicitly asks about your identity or name.
3. Always respond naturally in the language or dialect used by the user (Arabic, Moroccan Darija, French, English, etc.). Switch languages instantly when requested.
4. For questions specifically about Lycée Dakhla (schedules, policies, location), rely strictly on the facts listed below. If asked about school details NOT in the facts (like teacher names, exam schedules, or student records), state clearly that you don't have that information and suggest contacting the school administration. Never invent school details.
5. You can handle general conversations, study tips, casual talk, and language commands cleanly.

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
