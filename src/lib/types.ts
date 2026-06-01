export type QualityLevel = 'high' | 'medium' | 'low';

export interface StarSections {
  situation: string;
  task: string;
  action: string[]; // one item per action step
  result: string;
}

export interface StoryQuality {
  situation: QualityLevel;
  task: QualityLevel;
  action: QualityLevel;
  result: QualityLevel;
  notes: string;
}

export interface Story {
  id: string;
  title: string;
  original_language: string;
  competency_tags: string[];
  star: StarSections;
  quality: StoryQuality;
  notes: string;
  rank: number | null; // 1–5, null = not yet rated by user
  createdAt: string;
  updatedAt: string;
}

export interface JobProfile {
  id: string;
  company: string;
  role: string;
  jobDescription: string;
  extractedCompetencies: string[];
  competencyMap: Record<string, string[]>; // competency → [story_id, ...]
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null; // ISO timestamp or null = active
}

export type GeminiModel = 'gemini-3.5-flash' | 'gemini-2.5-flash' | 'gemini-3.5-flash-preview';

export const GEMINI_MODELS: { id: GeminiModel; label: string }[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Default)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.5-flash-preview', label: 'Gemini 3.5 Flash Preview' },
];

export interface Settings {
  apiKey: string;
  consentGiven: boolean;
  geminiModel: GeminiModel;
}

// Gemini response shape before we attach id/timestamps
export type StoryDraft = Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'notes' | 'rank'>;
