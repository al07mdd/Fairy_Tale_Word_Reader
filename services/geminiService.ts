import { WordData } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as T;
};

// 1. Generate a Word
export const generateWord = async (excludedWords: string[] = []): Promise<WordData> => {
  return await request<WordData>("/word", {
    method: "POST",
    body: JSON.stringify({ excludedWords }),
  });
};

// 2. Generate Image
export const generateImage = async (prompt: string): Promise<string | null> => {
  const data = await request<{ imageData: string }>("/image", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  }).catch((err) => {
    console.error("Image generation error:", err);
    return null;
  });

  return data?.imageData ?? null;
};

// 3. Generate Pronunciation (TTS)
export const generateTTS = async (text: string): Promise<string | null> => {
  const data = await request<{ audio: string }>("/tts", {
    method: "POST",
    body: JSON.stringify({ text }),
  }).catch((err) => {
    console.error("TTS error:", err);
    return null;
  });

  return data?.audio ?? null;
};

// 4. Check Pronunciation (Audio Analysis)
export const checkPronunciation = async (
  targetWord: string,
  audioBase64: string,
  mimeType = "audio/webm"
): Promise<boolean> => {
  const data = await request<{ correct: boolean }>("/pronunciation", {
    method: "POST",
    body: JSON.stringify({ targetWord, audioBase64, mimeType }),
  }).catch((err) => {
    console.error("Pronunciation check error:", err);
    return null;
  });

  return data?.correct ?? false;
};
