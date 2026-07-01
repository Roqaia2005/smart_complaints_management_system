import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from assistant.services.conversation import ConversationManager


def test_parse_json_extracts_object_from_wrapped_response():
    raw = '''Here is the briefing payload you requested:\n```json\n{"speaker":"analyst","text":"Updated briefing","topic":"Operations","risk_score":7.5,"recommendation":"Escalate now"}\n```'''

    parsed = ConversationManager._parse_json(raw)

    assert parsed == {
        "speaker": "analyst",
        "text": "Updated briefing",
        "topic": "Operations",
        "risk_score": 7.5,
        "recommendation": "Escalate now",
    }
