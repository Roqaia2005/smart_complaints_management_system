import asyncio
from assistant.services.tts_manager import TTSProviderManager
from assistant.providers.edge_tts import EdgeTTSProvider
from assistant.providers.kokoro_tts import KokoroTTSProvider

async def main():
    manager = TTSProviderManager([EdgeTTSProvider(), KokoroTTSProvider()])
    try:
        url = await manager.generate_audio('Hello from the assistant', 'analyst')
        print(url)
    except Exception as exc:
        print(type(exc).__name__, exc)

asyncio.run(main())
