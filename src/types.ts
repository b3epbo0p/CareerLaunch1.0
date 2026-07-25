export interface InterviewStory {
  id: string;
  title: string;
  role: string;
  industry: string;
  companyType: 'Startup' | 'Tech Giant' | 'Corporate' | 'Agency' | 'Consulting';
  experienceLevel: string;
  content: string;
  lessons: string[];
  mistakes: string[];
  successTips: string[];
  date: string;
  source: string;
}

export interface InterviewTip {
  id: string;
  category: 'before' | 'during' | 'after';
  title: string;
  description: string;
  actions: string[];
  source: string;
}

export type QuestionCategory = string;

export interface GeneratedQuestion {
  id: string;
  number?: number;
  text: string;
  category: QuestionCategory;
  intent: string;
  suggestedPoints: string[];
}

export interface QuestionSet {
  id: string;
  jobTitle: string;
  industry: string;
  level?: string;
  jobDescription: string;
  questions: GeneratedQuestion[];
  generatedAt: string;
  isSimulated?: boolean;
  sheetTitle?: string;
  organizationType?: string;
}

export interface MockInterviewQA {
  question: string;
  answer: string;
  score: number;
  clarity: string;
  relevance: string;
  professionalism: string;
  suggestions: string;
  roomForImprovement?: string;
  scoreBreakdown?: {
    domainAccuracy: number;
    starStructure: number;
    starDetailed?: {
      situation: number;
      task: number;
      action: number;
      result: number;
    };
    communication: number;
  };
}

export interface MockInterviewSession {
  id: string;
  date: string;
  role: string;
  industry: string;
  level: string;
  qas: MockInterviewQA[];
  questions?: any[];
  answers?: any[];
  status?: 'ongoing' | 'completed';
  overallScore: number;
  overallSummary?: string;
  strengths?: string[];
  improvements?: string[];
  suggestedResources?: string[];
  evaluationText?: string;
  isSimulated?: boolean;
  coachName?: string;
  coachRole?: string;
  isPythonCodingMode?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  targetRole: string;
  targetIndustry: string;
  targetCompanyType: string;
  experienceLevel?: string;
  resumeSummary?: string;
  bookmarkedQuestionIds?: string[];
  bookmarkedStoryIds?: string[];
  savedStories?: string[];
  savedTips?: string[];
  savedQuestionSets?: QuestionSet[];
  mockSessions?: MockInterviewSession[];
}
