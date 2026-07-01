import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const ASSISTANT_API_URL = import.meta.env.VITE_RECOMMENDATION_API_URL || 'http://127.0.0.1:5000';

const assistantApi = axios.create({
  baseURL: ASSISTANT_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

assistantApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  
  // Debug logging to verify token availability
  console.log('[Assistant API] Request to:', config.url);
  console.log('[Assistant API] Token available:', !!token);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[Assistant API] Authorization header set');
  } else {
    console.warn('[Assistant API] No token available - request will likely fail with 401');
  }
  
  return config;
});

// Response interceptor for better error handling
assistantApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[Assistant API] 401 Unauthorized:', {
        url: error.config?.url,
        message: error.response?.data?.detail || error.response?.data?.message || 'No token or invalid token',
        hasAuthHeader: !!error.config?.headers?.Authorization,
      });
      
      // Optional: Clear auth and redirect to login
      // useAuthStore.getState().logout();
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type AssistantSpeaker = 'host' | 'analyst';

export interface DialogueSegment {
  index: number;
  speaker: AssistantSpeaker;
  text: string;
  audio_url: string | null;
  topic: string;
  risk_score: number | null;
  recommendation: string | null;
}

export interface GenerateBriefingResponse {
  session_id: string;
  summary: string;
  dialogue: DialogueSegment[];
  suggested_questions: string[];
}

export interface AskQuestionResponse {
  answer: string;
  audio_url: string | null;
  resume_index: number;
  suggested_questions: string[];
}

export interface STTResponse {
  transcript: string;
  confidence: number;
  provider_used: string;
}

function absoluteAudioUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${ASSISTANT_API_URL}${url}`;
}

function normalizeDialogue(dialogue: DialogueSegment[]): DialogueSegment[] {
  return dialogue.map((segment) => ({
    ...segment,
    audio_url: absoluteAudioUrl(segment.audio_url),
  }));
}

export const assistantService = {
  async generateBriefing(forceRefresh = false): Promise<GenerateBriefingResponse> {
    // Pre-flight check: ensure token exists before making request
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    try {
      const response = await assistantApi.post<GenerateBriefingResponse>('/api/assistant/generate-briefing', {
        force_refresh: forceRefresh,
      });
      return {
        ...response.data,
        dialogue: normalizeDialogue(response.data.dialogue),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 
                            error.response?.data?.message || 
                            error.message || 
                            'Failed to generate briefing';
        
        // Provide user-friendly error messages
        if (error.response?.status === 401) {
          throw new Error('Session expired. Please log in again to access the assistant.');
        } else if (error.response?.status === 403) {
          throw new Error('Access denied. Assistant is only available for managers and admins.');
        } else if (error.response?.status === 500) {
          throw new Error('Server error. Please try again later or contact support.');
        }
        
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  async ask(sessionId: string, question: string, currentDialogueIndex: number): Promise<AskQuestionResponse> {
    // Pre-flight check: ensure token exists before making request
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    try {
      const response = await assistantApi.post<AskQuestionResponse>('/api/assistant/ask', {
        session_id: sessionId,
        question,
        current_dialogue_index: currentDialogueIndex,
      });
      return {
        ...response.data,
        audio_url: absoluteAudioUrl(response.data.audio_url),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || 
                            error.response?.data?.message || 
                            error.message || 
                            'Failed to get answer';
        
        if (error.response?.status === 401) {
          throw new Error('Session expired. Please log in again to continue the conversation.');
        } else if (error.response?.status === 403) {
          throw new Error('Access denied. Assistant is only available for managers and admins.');
        } else if (error.response?.status === 404) {
          throw new Error('Session not found. Please start a new briefing.');
        }
        
        throw new Error(errorMessage);
      }
      throw error;
    }
  },

  async transcribe(file: Blob): Promise<STTResponse> {
    // Pre-flight check: ensure token exists before making request
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    try {
      const form = new FormData();
      form.append('file', file, 'question.webm');
      const response = await assistantApi.post<STTResponse>('/api/assistant/stt', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Session expired. Please log in again to use voice input.');
        } else if (error.response?.status === 503) {
          throw new Error('Speech-to-text is temporarily unavailable. Please type your question instead.');
        }
        throw error;
      }
      throw error;
    }
  },

  async endSession(sessionId: string): Promise<void> {
    // Pre-flight check: ensure token exists before making request
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    try {
      await assistantApi.post('/api/assistant/end-session', { session_id: sessionId });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Session expired. Please log in again.');
        } else if (error.response?.status === 404) {
          throw new Error('Session not found or already ended.');
        }
        throw error;
      }
      throw error;
    }
  },
};

export default assistantService;
