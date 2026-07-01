"""
Target path: assistant/providers/groq_whisper.py  (REPLACES existing file)

Groq Whisper STT provider implementation.

CHANGE IN THIS VERSION
------------------------
transcribe() is declared `async def` (matching BaseSTTProvider's
contract) but was calling the synchronous Groq SDK directly:

    transcription = client.audio.transcriptions.create(...)

Since this is awaited directly from `async def transcribe_audio(...)` in
assistant/routes.py, that blocking network call was freezing the asyncio
event loop for the whole process during every voice transcription
request -- same class of bug as the dialogue-generation one in
director.py. Now wrapped in asyncio.to_thread() so it runs off the
event loop.
"""

from __future__ import annotations

import asyncio
import os

from groq import Groq

from assistant.providers.base_stt import BaseSTTProvider


class GroqWhisperProvider(BaseSTTProvider):
    """Cloud STT provider using Groq Whisper Large v3."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("GROQ_API_KEY", "")

    @property
    def provider_id(self) -> str:
        return "groq_whisper"

    async def transcribe(self, audio_file_path: str) -> str:
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")

        return await asyncio.to_thread(self._transcribe_sync, audio_file_path)

    def _transcribe_sync(self, audio_file_path: str) -> str:
        client = Groq(api_key=self.api_key)
        with open(audio_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3",
                response_format="json",
            )
        return transcription.text