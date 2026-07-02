"""Groq Whisper STT provider implementation."""

from __future__ import annotations

import os

from groq import Groq

from base_stt import BaseSTTProvider


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

        client = Groq(api_key=self.api_key)
        with open(audio_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3",
                response_format="json",
            )
        return transcription.text
