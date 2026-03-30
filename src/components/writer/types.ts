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
  technicalDensity: number;
  chartComplexity: number;
  figureNumbering: string;
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
  "Harvard",
  "APA 7th",
  "APA 6th",
  "MLA 9th",
  "Chicago 17 (Author-Date)",
  "Chicago 17 (Notes-Bibliography)",
  "Vancouver",
  "IEEE",
  "OSCOLA",
  "AGLC 4",
  "AMA",
  "Turabian",
];

export const academicLevels = [
  "Undergraduate L4", "Undergraduate L5", "Undergraduate L6", "Postgraduate L7", "Doctoral", "Professional",
];

// Models ranked by academic writing quality — best first
export const aiModels = [
  { id: "google/gemini-2.5-pro",         name: "Gemini 2.5 Pro",  desc: "Highest quality · deep analysis · best for complex academic work" },
  { id: "google/gemini-3.1-pro-preview",  name: "Gemini 3.1 Pro",  desc: "Next-generation reasoning · superior critical thinking" },
  { id: "openai/gpt-5",                   name: "GPT-5",            desc: "OpenAI flagship · strong reasoning and writing quality" },
  { id: "openai/gpt-5.2",                name: "GPT-5.2",          desc: "Latest OpenAI · enhanced reasoning" },
];

export const stageLabels = ["Brief", "Write", "Review", "Export"];

export const DATA_SOURCES_BY_CATEGORY: Record<string, string[]> = {
  "International Bodies": [
    "IMF", "World Bank", "OECD", "UN Statistics", "UNESCO", "WHO", "WTO", "ILO", "FAO",
    "UNICEF", "UNEP", "ITU", "UNCTAD", "WIPO", "BIS", "IFC", "EBRD", "ADB",
    "G20", "WEF — World Economic Forum",
  ],
  "Statistical Databases": [
    "Statista", "Our World in Data", "FRED — Federal Reserve Economic Data",
    "Eurostat", "UK ONS", "US Census Bureau", "UN Data", "Gapminder",
    "Knoema", "World Development Indicators", "Global Carbon Project",
    "Climate Watch", "Human Development Reports",
  ],
  "Finance & Economics": [
    "Bloomberg", "Reuters", "Financial Times", "Wall Street Journal",
    "S&P Global", "Moody's", "Fitch Ratings", "Morningstar",
    "European Central Bank", "US Federal Reserve", "Bank of England",
    "UK HM Treasury", "US Congressional Budget Office",
  ],
  "Consulting & Industry Research": [
    "McKinsey Global Institute", "Deloitte Insights", "PwC Research",
    "KPMG Insights", "EY Research", "BCG Research",
    "Gartner", "Forrester", "IDC", "Nielsen", "Ipsos",
    "Euromonitor", "IBISWorld", "Mintel", "Kantar", "YouGov",
    "Pew Research Center", "Gallup",
  ],
  "Technology": [
    "IEEE Xplore", "ACM Digital Library", "MIT Technology Review",
    "Wired", "TechCrunch", "VentureBeat", "CB Insights", "Crunchbase",
  ],
  "Health & Medicine": [
    "WHO Global Health Observatory", "CDC", "NIH", "NHS Digital",
    "NICE", "Lancet", "NEJM", "BMJ", "JAMA", "PubMed",
  ],
  "Environment & Energy": [
    "IPCC", "IEA — International Energy Agency", "Carbon Disclosure Project (CDP)",
    "WWF", "IRENA", "Global Footprint Network",
    "US EPA", "UK Environment Agency",
  ],
  "Business & Management": [
    "CIPD", "SHRM", "CMI — Chartered Management Institute",
    "CIM — Chartered Institute of Marketing", "ICAEW", "CIMA",
    "Harvard Business Review", "MIT Sloan Management Review",
    "Academy of Management", "Strategic Management Journal",
  ],
  "Academic Publishers": [
    "JSTOR", "Scopus", "Web of Science", "Google Scholar", "SSRN",
    "SpringerLink", "Elsevier ScienceDirect", "Wiley Online Library",
    "Taylor & Francis", "Oxford Academic", "Cambridge Core",
    "Sage Journals", "Emerald Insight",
  ],
  "Government & Policy": [
    "UK Government (GOV.UK)", "EU Commission", "US Government (USA.GOV)",
    "USDA", "Companies House", "UK Parliament", "US Congress",
    "Transparency International", "Freedom House",
  ],
};

export const DATA_SOURCES = Object.values(DATA_SOURCES_BY_CATEGORY).flat();

export const IMAGE_TYPES = [
  // Standard academic charts
  "Bar chart (grouped)",
  "Bar chart (stacked)",
  "Horizontal bar chart",
  "Line chart",
  "Scatter plot",
  "Box plot",
  "Histogram",
  "Pie chart",
  // Statistical / research charts
  "Forest plot",
  "Heatmap / Correlation matrix",
  "Kaplan-Meier curve",
  "ROC curve",
  "Radar / Spider chart",
  "Funnel plot",
  "Treemap",
  "Sankey / Alluvial diagram",
  // General
  "Infographic",
  "Diagram",
  "Conceptual model",
  "Framework diagram",
];

export const defaultSettings: WriterSettings = {
  type: "",
  topic: "",
  module: "",
  wordCount: "",
  citationStyle: "Harvard",
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
  technicalDensity: 3,
  chartComplexity: 3,
  figureNumbering: "Sequential",
  totalCitations: 0,
  includeImages: true,
  imageCount: 0,
  imageTypes: [],
  includeTables: true,
  tableCount: 0,
  statisticalSourceCount: 0,
  preferredDataSources: [],
};
