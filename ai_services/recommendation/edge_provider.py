"""Microsoft Edge TTS provider implementation."""

from __future__ import annotations

from base_tts import BaseTTSProvider


class EdgeTTSProvider(BaseTTSProvider):
    """Primary cloud-backed TTS provider using the edge-tts package."""

    @property
    def provider_id(self) -> str:
        return "edge"

    async def synthesize(self, text: str, voice_id: str, output_path: str) -> None:
        import edge_tts as edge_tts_pkg

        communicate = edge_tts_pkg.Communicate(text=text, voice=voice_id)
        await communicate.save(output_path)
