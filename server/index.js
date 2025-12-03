import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type, Modality } from '@google/genai';

const PORT = process.env.SERVER_PORT || process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. API calls will fail until the key is configured.');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const handleRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

app.post('/api/word', handleRoute(async (req, res) => {
  const excludedWords = Array.isArray(req.body?.excludedWords) ? req.body.excludedWords : [];
  const model = "gemini-2.5-flash";
  const excludedString = excludedWords.slice(-50).join(", ");
  
  const prompt = `
    Ñ-ÑüÑæÑ«Ñæ¥?¥ŸÑû ÑúÑøÑýÑïÑøÑ«Ñ«¥? ÑïÑ¯¥? ÑïÑ÷¥'Ñ÷Ñ«Ñ÷ (Ñý¥-Ñ§ 4-6 ¥?ÑóÑ§¥-Ñý), ¥?Ñ§Ñø Ñý¥ÎÑ÷¥'¥O¥?¥? ¥ÎÑ÷¥'Ñø¥'Ñ÷.
    ÑÝÑæ ÑzÑ'ÑzÑ''ÑîÑ-ÑsÑzÑ'Ñz Ñ¬Ñø¥" Ññ¥Ÿ¥'Ñ÷ ¥"¥?ÑøÑúÑø Ñú 2 ÑøÑñÑó 3 ¥?Ñ¯¥-Ñý (Ñ¬¥-Ñ«¥-Ñ¬¥ŸÑ¬ 2 ¥?Ñ¯ÑóÑýÑø). Ñ?Ñ ÑüÑæÑ«Ñæ¥?¥ŸÑû ÑóÑ§¥?ÑæÑ¬¥- ¥?Ñ¯ÑóÑýÑø.
    Ñ½ÑæÑ¬Ñ÷: ¥'ÑýÑø¥?Ñ÷Ñ«Ñ÷, ÑïÑ÷Ñ«ÑóÑúÑøÑý¥?Ñ÷, Ñ§Ñó¥?Ñ¬Ñó¥?, Ñ¨¥?Ñ÷¥?ÑóÑïÑø, ¥-Ñü¥?Ñø¥^Ñ§Ñ÷, Ñ¨¥?Ñó¥?¥'¥- Ñï¥-¥-.
    
    Ñ'Ñ?Ñ-Ñ>Ñ~Ñ'Ñz: Ñ?Ñæ ÑýÑ÷Ñ§Ñó¥?Ñ÷¥?¥'ÑóÑý¥ŸÑû ¥Å¥- ¥"¥?ÑøÑúÑ÷ (ÑýÑóÑ«Ñ÷ ÑýÑôÑæ Ññ¥ŸÑ¯Ñ÷): ${excludedString}.
    ÑÏ¥?ÑøÑúÑø Ñ¬Ñø¥" Ñ¨Ñó¥ÎÑ÷Ñ«Ñø¥'Ñ÷¥?¥? Ñú ÑýÑæÑ¯Ñ÷Ñ§Ñó¥- Ñ¯¥-¥'Ñæ¥?Ñ÷ (Sentence case).

    ÑYÑóÑýÑæ¥?Ñ«Ñ÷ JSON ÑóÑñ'¥"Ñ§¥':
    1. "cleanWord": ¥'ÑæÑ§¥?¥' ¥ŸÑ§¥?Ñø¥-Ñ«¥?¥OÑ§Ñó¥Z (Ñ«ÑøÑ¨¥?Ñ÷Ñ§Ñ¯ÑøÑï "Ñ­Ñ÷Ñ«¥-Ñû Ñ§Ñ÷¥'" ÑøÑñÑó "Ñ'ÑæÑ¯Ñ÷Ñ§Ñ÷Ñû ÑïÑ÷Ñ«ÑóÑúÑøÑý¥?").
    2. "syllables": ¥'ÑæÑ§¥?¥', ¥?ÑóÑúÑï¥-Ñ¯ÑæÑ«Ñ÷Ñû Ñ«Ñø ¥?Ñ§Ñ¯ÑøÑïÑ÷ ÑïÑæ¥"¥-¥?ÑøÑ¬Ñ÷ ÑïÑ¯¥? ¥ÎÑ÷¥'ÑøÑ«Ñ«¥? (Ñ«ÑøÑ¨¥?Ñ÷Ñ§Ñ¯ÑøÑï "Ñ­Ñ÷-Ñ«¥-Ñû Ñ§Ñ÷¥'" ÑøÑñÑó "Ñ'Ñæ-Ñ¯Ñ÷-Ñ§Ñ÷Ñû ÑïÑ÷-Ñ«Ñó-ÑúÑøÑý¥?").
    3. "imagePrompt": ÑóÑ¨Ñ÷¥? ÑïÑ¯¥? ÑüÑæÑ«Ñæ¥?Ñø¥Å¥-¥- ÑúÑóÑñ¥?ÑøÑôÑæÑ«Ñ«¥? ÑøÑ«ÑüÑ¯¥-Ñû¥?¥OÑ§Ñó¥Z: single isolated object representing the phrase, simple vector icon, white background, minimalist, flat style.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanWord: { type: Type.STRING },
            syllables: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
          },
          required: ["cleanWord", "syllables", "imagePrompt"],
        },
      },
    });

    if (response.text) {
      return res.json(JSON.parse(response.text));
    }
    throw new Error("No text returned from word generation");
  } catch (error) {
    console.error("Word generation error:", error);
    return res.json({
      cleanWord: "ÑoÑ÷Ñ¯Ñø Ñ§¥-¥^Ñ§Ñø",
      syllables: "ÑoÑ÷-Ñ¯Ñø Ñ§¥-¥^-Ñ§Ñø",
      imagePrompt: "cute cat vector icon, white background",
    });
  }
}));

app.post('/api/image', handleRoute(async (req, res) => {
  const prompt = (req.body?.prompt || '').toString();
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const model = "gemini-2.5-flash-image";
  const simplePrompt = `${prompt}, single isolated object, no background, white background, simple vector illustration, flat design, minimal details`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [{ text: simplePrompt }],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData && part.inlineData.data) {
      return res.json({
        imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      });
    }
  }

  return res.status(502).json({ error: "No image data returned" });
}));

app.post('/api/tts', handleRoute(async (req, res) => {
  const text = (req.body?.text || '').toString();
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const model = "gemini-2.5-flash-preview-tts";
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    return res.status(502).json({ error: "No audio returned" });
  }

  return res.json({ audio: base64Audio });
}));

app.post('/api/pronunciation', handleRoute(async (req, res) => {
  const targetWord = (req.body?.targetWord || '').toString();
  const audioBase64 = (req.body?.audioBase64 || '').toString();
  const mimeType = (req.body?.mimeType || 'audio/webm').toString();

  if (!targetWord || !audioBase64) {
    return res.status(400).json({ error: "targetWord and audioBase64 are required" });
  }

  const model = "gemini-2.5-flash";
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: `
              A child is trying to read the Ukrainian phrase: "${targetWord}".
              Listen to the audio. Did they say it correctly? 
              Ignore minor stuttering, pauses between syllables, or childish accent.
              Return JSON: { "correct": true } or { "correct": false }.
            `,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
        },
      },
    },
  });

  if (response.text) {
    const result = JSON.parse(response.text);
    return res.json({ correct: Boolean(result.correct) });
  }

  return res.status(502).json({ error: "No response text returned" });
}));

app.listen(PORT, () => {
  console.log(`Fairy Tale Reader API listening on port ${PORT}`);
});
