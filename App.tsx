import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, WordData } from './types';
import * as GeminiService from './services/geminiService';
import { blobToBase64, playPcmAudio } from './services/audioUtils';
import { Button } from './components/Button';

// Placeholder icons
const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const NextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

// History management
const HISTORY_KEY = 'read_word_history';
const HISTORY_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface HistoryEntry {
  word: string;
  timestamp: number;
}

const getExcludedWords = (): string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    
    const now = Date.now();
    const history: HistoryEntry[] = JSON.parse(raw);
    
    // Filter out old words
    const validHistory = history.filter(h => (now - h.timestamp) < HISTORY_DURATION);
    
    // Update storage if we filtered anything
    if (validHistory.length !== history.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validHistory));
    }

    return validHistory.map(h => h.word);
  } catch (e) {
    return [];
  }
};

const addWordToHistory = (word: string) => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    history.push({ word, timestamp: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Storage error", e);
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INITIAL);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ttsAudioBase64, setTtsAudioBase64] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [recording, setRecording] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>('');

  const loadNewLevel = useCallback(async () => {
    setGameState(GameState.LOADING);
    setWordData(null);
    setImageUrl(null);
    setTtsAudioBase64(null);
    setAttempts(0);
    setIsMediaLoading(false);

    try {
      // 1. Get Word (First priority)
      const excluded = getExcludedWords();
      const word = await GeminiService.generateWord(excluded);
      setWordData(word);
      addWordToHistory(word.cleanWord);
      
      // Allow user to see word immediately
      setGameState(GameState.READY);
      
      // 2. Load Media in Background
      setIsMediaLoading(true);
      
      // We don't await this blocking the UI
      Promise.allSettled([
        GeminiService.generateImage(word.imagePrompt),
        GeminiService.generateTTS(word.cleanWord)
      ])
        .then(([imgResult, audioResult]) => {
          if (imgResult.status === 'fulfilled') {
            setImageUrl(imgResult.value);
          } else {
            console.error("Image load error:", imgResult.reason);
          }

          if (audioResult.status === 'fulfilled') {
            setTtsAudioBase64(audioResult.value);
          } else {
            console.error("TTS load error:", audioResult.reason);
          }
        })
        .finally(() => setIsMediaLoading(false));

    } catch (e) {
      console.error(e);
      setGameState(GameState.ERROR);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadNewLevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayWord = () => {
    if (ttsAudioBase64) {
      playPcmAudio(ttsAudioBase64);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorderOptions: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav'];
        for (const type of preferredTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            recorderOptions.mimeType = type;
            break;
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      recordingMimeTypeRef.current = mediaRecorder.mimeType || recorderOptions.mimeType || 'audio/webm';
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recordingMimeTypeRef.current });
        await handleAnalysis(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setGameState(GameState.RECORDING);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Дозвольте доступ до мікрофону, щоб грати!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setGameState(GameState.EVALUATING);
    }
  };

  const handleAnalysis = async (audioBlob: Blob) => {
    if (!wordData) return;

    const base64Audio = await blobToBase64(audioBlob);
    const isCorrect = await GeminiService.checkPronunciation(
      wordData.cleanWord,
      base64Audio,
      audioBlob.type || recordingMimeTypeRef.current
    );

    if (isCorrect) {
      setGameState(GameState.SUCCESS);
      playSound("success");
      // Image revealed via render logic
    } else {
      playSound("failure");
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setGameState(GameState.FAILURE);
        // Fail state allows moving next
      } else {
        setGameState(GameState.READY);
      }
    }
  };

  // Simple sound effects helper
  const playSound = (type: "success" | "failure") => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Ding ding!
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else {
      // Tu tu tu (lower pitch, descending)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(100, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  };

  const isRoundOver = gameState === GameState.SUCCESS || gameState === GameState.FAILURE;

  return (
    <div className="fixed inset-0 bg-amber-900 p-2 sm:p-4 font-sans flex items-center justify-center overflow-hidden">
      
      {/* Main Book Container - Full Screen-ish */}
      <div className="relative w-full h-full bg-amber-50 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden border-4 border-amber-800">
        
        {/* Book Binding Visual (Center on Desktop) */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-8 bg-amber-900 transform -translate-x-1/2 z-10 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"></div>

        {/* LEFT PAGE: WORD & CONTROLS */}
        <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center border-b-4 md:border-b-0 md:border-r-4 border-amber-200 bg-[#fdfbf7] relative">
           {/* Paper texture overlay */}
           <div className="absolute inset-0 opacity-40 pointer-events-none" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/paper.png')"}}></div>

           <div className="relative z-0 w-full flex flex-col items-center h-full justify-center">
             {gameState === GameState.LOADING ? (
               <div className="animate-pulse w-full flex flex-col items-center">
                 <div className="h-16 w-3/4 bg-amber-200 rounded mb-8"></div>
                 <div className="h-12 w-1/2 bg-amber-200 rounded"></div>
               </div>
             ) : (
               <>
                  {/* Attempts Indicator */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <span key={i} className={`text-2xl transition-colors duration-300 ${i < (3 - attempts) ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`}>
                        ★
                      </span>
                    ))}
                  </div>

                  {/* The Word - Each word on a new line */}
                  <div className="mb-8 md:mb-12 text-center w-full flex-grow flex items-center justify-center">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-sans font-bold text-amber-900 tracking-normal drop-shadow-sm leading-tight flex flex-col gap-4 items-center">
                      {wordData?.syllables.split(' ').map((word, idx) => (
                        <span key={idx} className="block">{word}</span>
                      ))}
                    </h1>
                  </div>

                  {/* Controls Area */}
                  <div className="flex flex-col gap-4 w-full max-w-xs items-center justify-end pb-8">
                    
                    {/* Status Message */}
                    <div className="h-8 flex items-center justify-center w-full mb-1">
                      <div className="text-center font-bold text-lg md:text-xl font-sans">
                        {gameState === GameState.EVALUATING && <span className="text-amber-600 animate-pulse">Слухаю...</span>}
                        {gameState === GameState.SUCCESS && <span className="text-green-600 animate-bounce">Молодець! Чудово! 🎉</span>}
                        {gameState === GameState.FAILURE && <span className="text-red-500">Спробуємо інше слово...</span>}
                        {gameState === GameState.READY && attempts > 0 && <span className="text-orange-500">Спробуй ще раз!</span>}
                      </div>
                    </div>

                    {isRoundOver ? (
                      // Next Button (Only shows when round is over)
                      <Button 
                        variant="primary" 
                        onClick={loadNewLevel} 
                        className="flex items-center justify-center gap-2 w-full py-4 text-xl animate-[fadeIn_0.5s_ease-out]"
                      >
                        <span>Наступне слово</span>
                        <NextIcon />
                      </Button>
                    ) : (
                      // Play & Record Buttons
                      <>
                        {attempts >= 2 && (
                          <Button 
                            variant="secondary" 
                            onClick={handlePlayWord} 
                            // Show loading state on button if audio isn't ready but word is
                            disabled={!ttsAudioBase64 || gameState === GameState.RECORDING || gameState === GameState.EVALUATING}
                            className="flex items-center justify-center gap-2 w-full animate-[fadeIn_0.5s_ease-out]"
                          >
                            {isMediaLoading && !ttsAudioBase64 ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <SpeakerIcon />
                            )}
                            <span>{isMediaLoading && !ttsAudioBase64 ? "Завантажую..." : "Послухати"}</span>
                          </Button>
                        )}

                        {gameState === GameState.RECORDING ? (
                           <Button 
                            variant="record" 
                            onClick={stopRecording} 
                            className="flex items-center justify-center gap-2 w-full"
                          >
                            <div className="w-4 h-4 bg-white rounded-sm animate-spin"></div>
                            <span>Стоп</span>
                          </Button>
                        ) : (
                          <Button 
                            variant="primary" 
                            onClick={startRecording}
                            disabled={gameState === GameState.EVALUATING}
                            className="flex items-center justify-center gap-2 w-full py-4 text-xl"
                          >
                            <MicIcon />
                            <span>Читаю!</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
               </>
             )}
           </div>
        </div>

        {/* RIGHT PAGE: IMAGE (HIDDEN) */}
        <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center bg-[#fdfbf7] relative">
           {/* Paper texture overlay */}
           <div className="absolute inset-0 opacity-40 pointer-events-none" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/paper.png')"}}></div>
           
           <div className="relative z-0 w-full h-full flex items-center justify-center">
             {gameState === GameState.LOADING ? (
               <div className="flex flex-col items-center">
                 <div className="h-48 w-48 md:h-64 md:w-64 bg-amber-100 rounded-full animate-pulse mb-4"></div>
                 <p className="text-amber-800 text-xl font-bold animate-bounce">Готую завдання...</p>
               </div>
             ) : (
               <div className="relative group w-full max-w-md aspect-square flex items-center justify-center">
                  {/* Logic: Show image ONLY on SUCCESS */}
                  {gameState === GameState.SUCCESS ? (
                    imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt="Word illustration" 
                        className="bg-transparent w-full h-full object-contain animate-[popIn_0.5s_ease-out]"
                      />
                    ) : (
                      // Fallback if image failed or still loading (rare in success state unless really slow)
                      <div className="text-amber-400 font-bold">Картинка завантажується...</div>
                    )
                  ) : (
                    // Locked / Mystery State
                    <div className="w-full h-full flex items-center justify-center">
                       {/* Simplified 'Mystery' visual - just a big question mark or subtle outline */}
                       <div className="w-64 h-64 border-4 border-dashed border-amber-200 rounded-full flex items-center justify-center">
                          <span className="text-9xl text-amber-200/50 font-black select-none font-sans">?</span>
                       </div>
                    </div>
                  )}
               </div>
             )}
           </div>
        </div>

      </div>
      
      <div className="absolute bottom-2 left-4 text-amber-200/30 text-xs pointer-events-none">
        Gemini 2.5 Flash & Nano Banana
      </div>
      
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default App;
