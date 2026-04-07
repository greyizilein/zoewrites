export interface Section {
  id: string;
  assessment_id: string;
  title: string;
  content: string | null;
  word_target: number;
  word_current: number;
  sort_order: number;
  status: string;
  version: number;
  framework: string | null;
  citations: any;
  citation_count: number | null;
  purpose_scope: string | null;
  learning_outcomes: string | null;
  required_inputs: string | null;
  structure_formatting: string | null;
  constraints_text: string | null;
  a_plus_criteria: string | null;
  suggested_frameworks: any;
  created_at: string;
  updated_at: string;
}

export interface WriterSettings {
  citationStyle: string;
  academicLevel: string;
  assessmentType: string;
  writingTone: string;
  humanisationLevel: string;
  sourceDateFrom: number;
  sourceDateTo: number;
  firstPerson?: boolean;
  burstiness?: number;
}

export const STAGE_LABELS = [
  "Brief",
  "Plan",
  "Write",
  "Review",
  "Revise",
  "Export",
] as const;

export type StageName = (typeof STAGE_LABELS)[number];

export const ASSESSMENT_TYPES = [
  "Essay",
  "Report",
  "Case Study",
  "Literature Review",
  "Research Proposal",
  "Dissertation",
  "Business Report",
  "Legal Problem (IRAC)",
  "Systematic Review",
  "Reflective Writing",
] as const;

export const WRITING_TONES = [
  "Analytical",
  "Critical",
  "Evaluative",
  "Discursive",
  "Argumentative",
  "Reflective",
] as const;

export const CITATION_STYLES = [
  "Harvard",
  "APA 7",
  "OSCOLA",
  "Chicago",
  "Vancouver",
  "IEEE",
  "MLA",
] as const;

export const ACADEMIC_LEVELS = [
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
] as const;

export const DEFAULT_WRITER_SETTINGS: WriterSettings = {
  citationStyle: "Harvard",
  academicLevel: "L7",
  assessmentType: "Essay",
  writingTone: "Analytical",
  humanisationLevel: "High",
  sourceDateFrom: 2015,
  sourceDateTo: 2025,
  firstPerson: false,
  burstiness: 3,
};
