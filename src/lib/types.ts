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
  rank: number; // 1–5, default 3
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
}

export interface Settings {
  apiKey: string;
  consentGiven: boolean;
}

// Gemini response shape before we attach id/timestamps
export type StoryDraft = Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'notes' | 'rank'>;
