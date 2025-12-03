// Convert Blob to Base64 string
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g., "data:audio/wav;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Base64 decoding for PCM audio (simplified for the TTS response format if needed)
// Standard helper to decode base64 string to byte array
export const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Play audio buffer from Gemini TTS response
export const playPcmAudio = async (base64Audio: string, sampleRate = 24000) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass({ sampleRate });
    
    // Decode base64 to bytes
    const bytes = decodeBase64ToBytes(base64Audio);
    
    // Gemini TTS output is often raw PCM. We need to put it into a buffer.
    // NOTE: If the model output format changes to WAV container, we would use decodeAudioData.
    // Based on guidelines, it suggests manual decoding for raw PCM if that's what is returned.
    // However, for standard Modality.AUDIO responses, we often get a container or raw data.
    // Let's try to assume raw PCM 16-bit mono for safety based on typical Live API/TTS patterns, 
    // OR create a standard flow for audio context decoding.
    
    // Attempt standard decode first (safer if headers exist)
    try {
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        return;
    } catch (e) {
        // Fallback: Manually decode raw PCM 16-bit Little Endian
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, dataInt16.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    }

  } catch (err) {
    console.error("Audio playback error:", err);
  }
};
