export interface Section {
  id: string;
  title: string;
  word_target: number;
  word_current: number;
  status: string;
  content: string | null;
  framework: string | null;
  sort_order: number;
  citation_count: number | null;
  a_plus_criteria?: string;
  purpose_scope?: string | null;
  learning_outcomes?: string | null;
  required_inputs?: string | null;
  structure_formatting?: string | null;
  constraints_text?: string | null;
  suggested_frameworks?: string[] | null;
}

export interface AssessmentData {
  id: string;
  title: string;
  type: string | null;
  brief_text: string | null;
  word_target: number;
  word_current: number;
  status: string;
  settings: any;
  execution_plan: any;
}

export interface WriterSettings {
  type: string;
  topic: string;
  module: string;
  wordCount: string;
  citationStyle: string;
  level: string;
  language: string;
  model: string;
  sourceDateFrom: string;
  sourceDateTo: string;
  useSeminalSources: boolean;
  institution: string;
  humanisation: string;
  grammarPipeline: string;
  autoImages: boolean;
  writingTone: string;
  formalityLevel: number;
  hedgingIntensity: string;
  firstPerson: boolean;
  sentenceComplexity: string;
  transitionStyle: string;
  paragraphLength: string;
  analysisDepth: string;
  // Content & quality settings
  totalCitations: number;
  includeImages: boolean;
  imageCount: number;
  imageTypes: string[];
  includeTables: boolean;
  tableCount: number;
  statisticalSourceCount: number;
  preferredDataSources: string[];
}

export interface Recommendation {
  type: string;
  severity: string;
  description: string;
  action: string;
}

export const assessmentTypes = [
  { emoji: "📊", title: "Strategic Analysis", desc: "Porter's, SWOT, PESTLE" },
  { emoji: "📝", title: "Essay", desc: "Argumentative, analytical" },
  { emoji: "📑", title: "Report", desc: "Business, consulting" },
  { emoji: "🔬", title: "Lit. Review", desc: "Systematic, narrative" },
  { emoji: "💻", title: "Code", desc: "Python, R, SQL, MATLAB" },
  { emoji: "📋", title: "Other", desc: "Custom — specify below" },
];

export const citationStyles = [
  "Harvard (UK)", "APA 7th", "APA 6th", "MLA 9th", "Chicago", "Vancouver", "IEEE", "OSCOLA",
];

export const academicLevels = [
  "Undergraduate L4", "Undergraduate L5", "Undergraduate L6", "Postgraduate L7", "Doctoral", "Professional",
];

// Models ranked by academic writing quality — best first
export const aiModels = [
  { id: "google/gemini-2.5-pro", name: "ZOE Pro — Gemini 2.5 Pro", desc: "Highest quality · deep analysis · best for complex academic work" },
  { id: "google/gemini-3.1-pro-preview", name: "ZOE Max — Gemini 3.1 Pro", desc: "Next-generation reasoning · superior critical thinking" },
  { id: "openai/gpt-5", name: "GPT-5", desc: "OpenAI flagship · strong reasoning and writing quality" },
  { id: "openai/gpt-5.2", name: "GPT-5.2", desc: "Latest OpenAI · enhanced reasoning" },
  { id: "google/gemini-2.5-flash", name: "ZOE Standard — Gemini 2.5 Flash", desc: "Fast & balanced · recommended default for most work" },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", desc: "Next-gen speed · good quality-to-speed ratio" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", desc: "OpenAI balanced · faster with good quality" },
  { id: "google/gemini-2.5-flash-lite", name: "ZOE Rapid — Gemini 2.5 Flash Lite", desc: "Fastest · best for quick tasks and editing" },
];

export const stageLabels = ["Brief", "Write", "Review", "Export"];

export const DATA_SOURCES = [
  "Statista", "Gartner", "World Bank", "IMF", "OECD", "Bloomberg", "McKinsey", "Reuters",
];

export const IMAGE_TYPES = ["Graphs", "Charts", "Infographics", "Diagrams", "Tables as Figures"];

export const defaultSettings: WriterSettings = {
  type: "",
  topic: "",
  module: "",
  wordCount: "",
  citationStyle: "Harvard (UK)",
  level: "Postgraduate L7",
  language: "UK English",
  model: "google/gemini-2.5-pro",
  sourceDateFrom: "2015",
  sourceDateTo: "2025",
  useSeminalSources: true,
  institution: "",
  humanisation: "High",
  grammarPipeline: "Full 7-stage",
  autoImages: true,
  writingTone: "Academic Formal",
  formalityLevel: 4,
  hedgingIntensity: "Medium",
  firstPerson: false,
  sentenceComplexity: "Mixed",
  transitionStyle: "Formal connectors",
  paragraphLength: "Medium",
  analysisDepth: "Deep Critical",
  totalCitations: 0,
  includeImages: true,
  imageCount: 0,
  imageTypes: [],
  includeTables: true,
  tableCount: 0,
  statisticalSourceCount: 0,
  preferredDataSources: [],
};
