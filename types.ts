export enum GameState {
  INITIAL = 'INITIAL',
  LOADING = 'LOADING',
  READY = 'READY',
  RECORDING = 'RECORDING',
  EVALUATING = 'EVALUATING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  ERROR = 'ERROR'
}

export interface WordData {
  syllables: string; // e.g., "ди-но-завр"
  cleanWord: string; // e.g., "динозавр"
  imagePrompt: string; // Prompt for the image generator
}

export interface EvaluationResult {
  correct: boolean;
  message: string;
}
