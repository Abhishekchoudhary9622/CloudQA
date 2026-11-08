import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config();

export interface AppConfig {
  llmProvider: 'gemini' | 'openai' | 'heuristic';
  geminiApiKey?: string;
  openaiApiKey?: string;
  headless: boolean;
  browserTimeout: number;
  serverPort: number;
  screenshotsDir: string;
  reportsDir: string;
}

export function loadConfig(): AppConfig {
  const provider = (process.env.LLM_PROVIDER || 'heuristic').toLowerCase();
  const validProvider = provider === 'gemini' || provider === 'openai' ? provider : 'heuristic';

  return {
    llmProvider: validProvider,
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    headless: process.env.HEADLESS !== 'false', // default to headless true unless explicitly false
    browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '20000', 10),
    serverPort: parseInt(process.env.PORT || '3000', 10),
    screenshotsDir: path.resolve(process.cwd(), 'screenshots'),
    reportsDir: path.resolve(process.cwd(), 'reports')
  };
}

