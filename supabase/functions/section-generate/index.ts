import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getZoeBrain } from "../_shared/zoe-brain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Infer citation density targets based on section title/type */
function getCitationDensity(title: string): { min: number; recommended: number; max: number } {
  // Target: 12 citations per 1000 words baseline
  const t = title.toLowerCase();
  if (t.includes("literature") || t.includes("lit review") || t.includes("lit.")) return { min: 14, recommended: 18, max: 25 };
  if (t.includes("introduction")) return { min: 6, recommended: 10, max: 14 };
  if (t.includes("conclusion")) return { min: 4, recommended: 8, max: 12 };
  if (t.includes("methodology") || t.includes("method")) return { min: 8, recommended: 12, max: 18 };
  if (t.includes("discussion") || t.includes("analysis")) return { min: 10, recommended: 14, max: 20 };
  if (t.includes("finding") || t.includes("result")) return { min: 8, recommended: 12, max: 16 };
  if (t.includes("recommendation")) return { min: 6, recommended: 10, max: 14 };
  // Default: 12 per 1000 words
  return { min: 8, recommended: 12, max: 18 };
}

/** Get academic level depth multiplier and expectations */
function getLevelExpectations(level: string): { depth: string; criticalThinking: string; analysisGuidance: string } {
  const l = level.toLowerCase();
  if (l.includes("doctoral")) return {
    depth: "DOCTORAL",
    criticalThinking: "Original contribution to knowledge required. Challenge existing paradigms. Synthesise across disciplines. Demonstrate methodological sophistication and epistemological awareness.",
    analysisGuidance: "Every framework application must interrogate assumptions, identify contradictions between models, propose extensions or modifications. Engage with counter-arguments at the deepest level."
  };
  if (l.includes("l7") || l.includes("postgraduate") || l.includes("masters")) return {
    depth: "POSTGRADUATE (L7)",
    criticalThinking: "Demonstrate mastery of subject through sophisticated critical evaluation. Synthesise multiple theoretical perspectives. Identify limitations and propose alternatives. Show independent thought beyond taught material.",
    analysisGuidance: "Framework analyses must go beyond surface application — interrogate why each factor matters, how factors interact, what the strategic implications are, and what the limitations of the framework itself are in this context."
  };
  if (l.includes("l6")) return {
    depth: "UNDERGRADUATE L6 (Final Year)",
    criticalThinking: "Strong critical evaluation expected. Compare and contrast theoretical positions. Evaluate evidence quality. Demonstrate ability to form independent, evidence-based judgements.",
    analysisGuidance: "Apply frameworks with depth: explain each component, support with evidence, evaluate significance, and draw strategic conclusions. Go beyond description to evaluation."
  };
  if (l.includes("l5")) return {
    depth: "UNDERGRADUATE L5",
    criticalThinking: "Developing critical thinking. Compare different perspectives. Begin to evaluate evidence and form arguments. Show awareness of complexity.",
    analysisGuidance: "Apply frameworks thoroughly: explain, illustrate with examples, and begin to evaluate significance. Balance description with analysis."
  };
  return {
    depth: "UNDERGRADUATE L4",
    criticalThinking: "Demonstrate understanding of key concepts. Apply theories to examples. Show ability to describe and explain with some evaluation.",
    analysisGuidance: "Apply frameworks clearly: define terms, describe each component, provide examples. Begin to offer evaluation where possible."
  };
}

/** Get framework application rules for common strategic/analytical frameworks */
function getFrameworkRules(framework: string): string {
  const f = framework.toLowerCase();
  
  if (f.includes("swot")) return `
SWOT ANALYSIS — INDUSTRY-STANDARD APPLICATION:
- Structure as a 2×2 matrix (Strengths, Weaknesses, Opportunities, Threats) presented as a markdown table
- Each quadrant must contain 4–6 substantive points, not single words
- Every point must be evidence-based with citations
- CRITICAL: After the matrix, provide a TOWS cross-analysis showing how strengths can exploit opportunities (SO), how strengths can counter threats (ST), how opportunities can overcome weaknesses (WO), and how to minimise weaknesses and avoid threats (WT)
- Do NOT just list factors — evaluate their relative importance and strategic implications
- Connect internal factors (S/W) to external factors (O/T) explicitly
- Rank factors by significance where applicable`;

  if (f.includes("porter") && f.includes("five")) return `
PORTER'S FIVE FORCES — INDUSTRY-STANDARD APPLICATION:
- Analyse ALL five forces: (1) Threat of New Entrants, (2) Bargaining Power of Suppliers, (3) Bargaining Power of Buyers, (4) Threat of Substitutes, (5) Competitive Rivalry
- Each force must be rated (High/Medium/Low) with evidence-based justification
- Include a summary table rating each force
- CRITICAL: Do NOT just describe each force — evaluate its IMPACT on industry profitability
- Discuss how forces interact and reinforce each other
- Consider dynamic changes: how forces are shifting over time
- End with strategic implications: what does the five forces picture mean for the firm?`;

  if (f.includes("pestle") || f.includes("pestel") || f.includes("pest")) return `
PESTLE ANALYSIS — INDUSTRY-STANDARD APPLICATION:
- Cover ALL six factors: Political, Economic, Social, Technological, Legal, Environmental
- Each factor must have 3–5 substantive points with current evidence and citations
- Present as a structured analysis with clear subheadings per factor
- CRITICAL: Do NOT just list macro-environmental factors — evaluate their IMPACT on the organisation/industry
- Rate each factor's significance (High/Medium/Low impact)
- Consider interconnections between PESTLE factors
- Include a summary table showing key factors, impact level, and strategic implications
- Use current data and statistics (within source date range)`;

  if (f.includes("porter") && f.includes("generic")) return `
PORTER'S GENERIC STRATEGIES — APPLICATION:
- Analyse all three strategies: Cost Leadership, Differentiation, Focus (Cost Focus + Differentiation Focus)
- Evaluate which strategy the organisation currently pursues with evidence
- Assess strategy fit with industry structure (link to Five Forces if applicable)
- Discuss risks of being "stuck in the middle"
- Recommend optimal strategic positioning with justification`;

  if (f.includes("ansoff")) return `
ANSOFF MATRIX — APPLICATION:
- Present as a 2×2 matrix: Market Penetration, Market Development, Product Development, Diversification
- Evaluate each quadrant's applicability to the organisation with evidence
- Assess risk levels for each strategy
- Recommend optimal growth strategy with justification`;

  if (f.includes("vrio") || f.includes("vrin")) return `
VRIO/VRIN FRAMEWORK — APPLICATION:
- Identify key resources and capabilities
- Evaluate each against ALL four criteria: Valuable, Rare, Inimitable (costly to imitate), Organised (non-substitutable)
- Present as a table showing each resource against VRIO criteria
- Identify which resources provide sustained competitive advantage vs. temporary advantage vs. competitive parity
- Link to strategic recommendations`;

  if (f.includes("mckinsey") || f.includes("7s")) return `
McKINSEY 7S FRAMEWORK — APPLICATION:
- Analyse ALL seven elements: Strategy, Structure, Systems, Shared Values, Skills, Style, Staff
- Distinguish hard Ss (Strategy, Structure, Systems) from soft Ss (Shared Values, Skills, Style, Staff)
- Evaluate alignment between elements — misalignments are key findings
- Present interconnections visually or in a structured table
- Focus on how misalignment drives organisational problems`;

  if (f.includes("balanced scorecard") || f.includes("bsc")) return `
BALANCED SCORECARD — APPLICATION:
- Cover ALL four perspectives: Financial, Customer, Internal Business Processes, Learning & Growth
- Each perspective must have specific objectives, measures, targets, and initiatives
- Show cause-and-effect linkages between perspectives
- Present as a structured table or framework`;

  if (f.includes("value chain")) return `
VALUE CHAIN ANALYSIS — APPLICATION:
- Analyse ALL primary activities: Inbound Logistics, Operations, Outbound Logistics, Marketing & Sales, Service
- Analyse ALL support activities: Firm Infrastructure, HR Management, Technology Development, Procurement
- Identify sources of competitive advantage in each activity
- Evaluate margin implications
- Link to cost drivers and differentiation opportunities`;

  // ── QUANTITATIVE ANALYSIS METHODS ──────────────────────────────────────────

  if (f.includes("descriptive statistic")) return `
DESCRIPTIVE STATISTICS — APPLICATION:
- Report mean, median, mode, standard deviation, range, min/max for all continuous variables
- Include frequency distribution tables for categorical variables
- Present a summary statistics table — properly formatted with variable names, N, Mean, SD, Min, Max
- Include a frequency distribution table or histogram where appropriate
- Discuss the distribution shape: skewness, kurtosis, normality assessment
- Every figure must be cited with its source data; interpret what the statistics reveal about the research question`;

  if (f.includes("t-test") || f.includes("independent samples") || f.includes("paired samples")) return `
T-TEST ANALYSIS — APPLICATION:
${f.includes("paired") ? "PAIRED SAMPLES T-TEST:" : "INDEPENDENT SAMPLES T-TEST:"}
- State the null and alternative hypotheses explicitly
- Report: t-statistic, degrees of freedom (df), p-value, Cohen's d (effect size), 95% CI of mean difference
- Present results in APA format: t(df) = X.XX, p = .XXX, d = X.XX, 95% CI [X.XX, X.XX]
- ${f.includes("paired") ? "Include a pre-post comparison table showing means and SDs for each time point" : "Include a group comparison table showing means, SDs, and sample sizes per group"}
- ${f.includes("paired") ? "Plot a pre-post line chart showing change per condition" : "Include a grouped bar chart or box plot comparing the two groups"}
- Verify and report assumption checks: normality (Shapiro-Wilk), ${f.includes("paired") ? "normality of differences" : "homogeneity of variance (Levene's test)"}
- Interpret the effect size: small (d<0.2), medium (d=0.5), large (d>0.8) by Cohen's convention
- Conclude whether the null hypothesis is rejected and what this means for the research question`;

  if (f.includes("one-way anova") || f.includes("anova")) return `
${f.includes("two-way") ? "TWO-WAY ANOVA" : "ONE-WAY ANOVA"} — APPLICATION:
- State hypotheses for ${f.includes("two-way") ? "main effects of each IV and the interaction effect" : "the group comparison"}
- Report: F-statistic (between/within df), p-value, partial η² (effect size)
${f.includes("two-way") ? "- Report main effects F/p for each IV, and the interaction effect F/p and partial η²\n- Describe the interaction: does the effect of one IV depend on the level of the other?" : "- If significant, run post-hoc tests (Tukey HSD recommended) and report pairwise comparisons"}
- Present a summary ANOVA table: Source, SS, df, MS, F, p, partial η²
- ${f.includes("two-way") ? "Plot an interaction plot (line chart with two factors)" : "Plot a grouped bar chart with error bars (95% CI)"}
- Report assumption checks: normality per group, homogeneity of variance (Levene's)
- Interpret effect size: small (η²<0.01), medium (η²=0.06), large (η²>0.14)`;

  if (f.includes("pearson") || f.includes("correlation")) return `
${f.includes("spearman") ? "SPEARMAN RANK CORRELATION" : "PEARSON CORRELATION"} — APPLICATION:
- State the null hypothesis: no significant ${f.includes("spearman") ? "rank" : "linear"} relationship between variables
- Report: ${f.includes("spearman") ? "ρ (rho)" : "r"} coefficient, p-value, sample size (n), ${f.includes("spearman") ? "confidence interval where possible" : "95% CI of r, r²"}
- Present a correlation matrix if multiple variables are analysed
- ${f.includes("spearman") ? "Plot a scatter plot with rank labels" : "Plot a scatter plot with regression line and confidence band"}
- Interpret direction (positive/negative) and strength: |r|<0.3 weak, 0.3–0.7 moderate, >0.7 strong
- Report r² to indicate proportion of variance explained (Pearson only)
- Check assumptions: ${f.includes("spearman") ? "ordinal data or non-normal distributions" : "bivariate normality, linearity, homoscedasticity"}`;

  if (f.includes("regression") && !f.includes("logistic")) return `
${f.includes("multiple") ? "MULTIPLE" : "SIMPLE"} LINEAR REGRESSION — APPLICATION:
- State the null hypothesis for ${f.includes("multiple") ? "each predictor" : "the slope"}
- Report: R², ${f.includes("multiple") ? "adjusted R², " : ""}F-statistic (ANOVA table), and for each predictor: B coefficient, SE, β (standardised), t, p
- ${f.includes("multiple") ? "Check and report VIF for multicollinearity (VIF>10 indicates serious multicollinearity)" : "Report the regression equation: Ŷ = a + bX"}
- Present a regression coefficients table with all statistics
- ${f.includes("multiple") ? "Plot a coefficient plot (lollipop chart) showing standardised betas" : "Plot the regression line with confidence band on a scatter plot"}
- Report assumption checks: linearity, normality of residuals (Q-Q plot), homoscedasticity, independence
- Interpret R² (variance explained) and the practical significance of coefficients`;

  if (f.includes("logistic regression") || f.includes("binary logistic")) return `
BINARY LOGISTIC REGRESSION — APPLICATION:
- State the null hypothesis for each predictor
- Report: Nagelkerke R², χ² (model fit), classification accuracy table
- For each predictor report: B, SE, Wald statistic, p-value, OR (Odds Ratio), 95% CI for OR
- Present a coefficient table with all statistics
- Plot a ROC curve and report AUC; plot an odds ratio forest plot
- Report assumption checks: linearity of log odds (Box-Tidwell), absence of multicollinearity (VIF), sample size (≥10 events per predictor)
- Interpret ORs: OR>1 increases odds of outcome, OR<1 decreases odds`;

  if (f.includes("chi-square") || f.includes("chi square")) return `
CHI-SQUARE TEST — APPLICATION:
- State the null hypothesis: no significant association between the two categorical variables
- Report: χ² statistic, df, p-value, Cramér's V (effect size), cross-tabulation table
- Present a cross-tabulation with observed and expected frequencies
- Plot a clustered bar chart or mosaic plot
- Report assumption checks: expected cell count ≥5 in ≥80% of cells; if violated, use Fisher's Exact Test
- Interpret Cramér's V: V<0.1 negligible, 0.1–0.3 small, 0.3–0.5 moderate, >0.5 large`;

  if (f.includes("mann-whitney")) return `
MANN-WHITNEY U TEST — APPLICATION:
- State null hypothesis: no difference in median ranks between the two groups
- Report: U statistic, Z (or exact p), p-value, effect size r (r = Z/√N), median and IQR per group
- Present a group comparison table with median, IQR, n per group
- Plot a box plot comparing the two groups
- Explain why the non-parametric test was chosen (normality violation or ordinal data)
- Interpret effect size r: r=0.1 small, r=0.3 medium, r=0.5 large`;

  if (f.includes("kruskal-wallis") || f.includes("kruskal wallis")) return `
KRUSKAL-WALLIS TEST — APPLICATION:
- State null hypothesis: no significant difference in median ranks across groups
- Report: H statistic, df, p-value; post-hoc Dunn's test with Bonferroni correction if significant
- Present a group comparison table with medians and IQRs
- Plot a notched box plot comparing all groups
- Explain choice of non-parametric test (>2 groups, normality violated)
- Report post-hoc pairwise comparisons with adjusted p-values`;

  if (f.includes("factor analysis") || f.includes("efa")) return `
EXPLORATORY FACTOR ANALYSIS (EFA) — APPLICATION:
- Report KMO statistic (should be ≥0.6) and Bartlett's test of sphericity (should be significant)
- Report eigenvalues and present a scree plot to justify factor retention
- Present a factor loadings matrix; cross-loadings should be discussed
- Report total variance explained per factor and cumulative variance
- Plot a factor loading heatmap
- Interpret each factor based on the items that load on it (loadings ≥0.4 conventionally)
- Discuss rotation method used (Varimax for orthogonal, Oblimin for correlated factors)`;

  if (f.includes("cronbach") || f.includes("reliability")) return `
CRONBACH'S ALPHA — RELIABILITY ANALYSIS — APPLICATION:
- Report overall α value per subscale (α≥0.7 considered acceptable; ≥0.8 good; ≥0.9 excellent)
- Present item-total correlation for each item
- Report α-if-item-deleted for each item and flag any items that substantially improve reliability if removed
- Plot an item reliability bar chart
- Discuss implications for scale validity and suggest items for removal or revision if needed`;

  if (f.includes("structural equation") || f.includes("sem")) return `
STRUCTURAL EQUATION MODELLING (SEM) — APPLICATION:
- Report model fit indices: CFI (≥0.95 good), TLI (≥0.95), RMSEA (≤0.06 good, ≤0.08 acceptable), SRMR (≤0.08)
- Report χ²/df ratio (≤3 acceptable)
- Present path coefficients (standardised β) and loadings with significance (p-values)
- Describe the SEM path diagram textually (nodes = latent variables, arrows = paths, coefficients labelled)
- Report direct, indirect, and total effects for mediation paths where applicable
- Discuss model modifications (modification indices) and respecification rationale`;

  if (f.includes("cluster analysis") || f.includes("clustering")) return `
CLUSTER ANALYSIS — APPLICATION:
- Justify clustering method (k-means for spherical clusters, hierarchical for unknown k, DBSCAN for density-based)
- Describe dendrogram (for hierarchical) or silhouette score to determine optimal k
- Report silhouette coefficient per cluster and overall (>0.5 = reasonable, >0.7 = strong structure)
- Present a cluster profile table: mean values per variable for each cluster, with cluster labels
- Discuss each cluster's distinctive characteristics relative to others
- Evaluate business/research implications of cluster membership`;

  if (f.includes("time series")) return `
TIME SERIES ANALYSIS — APPLICATION:
- Decompose series into: trend, seasonality, and residual/irregular components
- Plot time series line chart with trend line overlay
- Report autocorrelation (ACF) and partial autocorrelation (PACF) plots to identify patterns
- If forecasting: report ARIMA model parameters (p,d,q) with AIC/BIC for model selection
- Report forecast accuracy: RMSE, MAE, MAPE
- Discuss stationarity (ADF test) and any differencing applied`;

  if (f.includes("survival analysis") || f.includes("kaplan-meier") || f.includes("kaplan meier")) return `
SURVIVAL ANALYSIS (KAPLAN-MEIER) — APPLICATION:
- Report median survival time with 95% CI for each group
- Present Kaplan-Meier survival curve — described textually and rendered as figure
- Report log-rank test p-value for between-group comparison
- Report hazard ratio (HR) with 95% CI if Cox regression is included
- Discuss censoring: how many observations were censored and why
- Interpret survival probability at key time points`;

  if (f.includes("meta-analysis") || f.includes("meta analysis")) return `
META-ANALYSIS — APPLICATION:
- Report pooled effect size (Cohen's d or OR/RR) with 95% CI using random-effects model
- Report I² statistic (heterogeneity): I²<25% low, 25–75% moderate, >75% high
- Report τ² (between-study variance) and Cochrane Q test for heterogeneity
- Present a forest plot described textually (effect size squares + whiskers + diamond for pooled estimate)
- Assess publication bias: Funnel plot asymmetry, Egger's test
- Conduct subgroup analysis if heterogeneity is high
- In Word export, forest plot is rendered as a data table; in PDF as a chart`;

  // ── QUALITATIVE ANALYSIS METHODS ────────────────────────────────────────────

  if (f.includes("thematic analysis") || (f.includes("braun") && f.includes("clarke"))) return `
THEMATIC ANALYSIS (BRAUN & CLARKE 2006) — APPLICATION:
- Follow all 6 phases: (1) familiarisation, (2) generating codes, (3) searching for themes, (4) reviewing themes, (5) defining and naming themes, (6) writing up
- Present 3–5 themes with names, definitions, and supporting participant quotes (in quotation marks with pseudonym/ID)
- Include a theme frequency table: how many participants mentioned each theme (n = X)
- Apply reflexive approach — acknowledge researcher positionality and interpretive choices
- Use inductive coding (data-driven) or deductive (theory-driven) as appropriate and state which
- Demonstrate analytical depth: go beyond description to explain what themes reveal about the research question`;

  if (f.includes("framework analysis")) return `
FRAMEWORK ANALYSIS — APPLICATION:
- Describe the analytical framework used and its origin
- Present a framework matrix: rows = participants/cases, columns = framework categories
- Populate matrix with participant responses and conduct cell-by-cell analysis
- Identify patterns, exceptions, and deviant cases
- Useful for applied policy and health research with predefined categories`;

  if (f.includes("content analysis")) return `
CONTENT ANALYSIS — APPLICATION:
- Describe the coding scheme: categories, definitions, and decision rules
- Report inter-rater reliability: Cohen's κ (κ≥0.6 acceptable; ≥0.8 good)
- Present a coding category table with frequency counts and percentages
- Distinguish manifest (surface) from latent (interpretive) content analysis
- Report unit of analysis (word, sentence, paragraph, document)
- Discuss the representativeness of the sample of texts analysed`;

  if (f.includes("grounded theory")) return `
GROUNDED THEORY — APPLICATION:
- Describe the coding process: open codes → axial codes → selective codes
- Present core category and explain how it integrates the theory
- Report theoretical saturation: at what point did new data stop producing new codes?
- Discuss constant comparative method throughout data collection
- Identify the emergent substantive theory and its relationship to existing literature
- Describe memoing and reflexivity practices used`;

  if (f.includes("interpretive phenomenological") || f.includes("ipa")) return `
INTERPRETIVE PHENOMENOLOGICAL ANALYSIS (IPA) — APPLICATION:
- Justify sample size: IPA uses small, purposive samples (6–15 participants typical)
- Present superordinate and subordinate themes for each participant or across participants
- Include rich textual descriptions for each theme with verbatim participant quotes
- Apply double hermeneutic: researcher interpreting participant making sense of experience
- Acknowledge researcher's own perspective and how it shaped interpretation
- Present themes with supporting evidence: quotes, frequency of mention, variation across cases`;

  if (f.includes("discourse analysis")) return `
DISCOURSE ANALYSIS — APPLICATION:
- Identify discursive strategies used in the text/speech
- Analyse subject positions: how speakers position themselves and others
- Identify ideological assumptions embedded in language choices
- Discuss power relations constructed through discourse
- Apply specific tradition (Foucauldian, Critical Discourse Analysis, Conversation Analysis) as stated
- Quote and analyse specific linguistic features: nominalisations, modality, presuppositions`;

  if (f.includes("narrative analysis") || f.includes("narrative inquiry")) return `
NARRATIVE ANALYSIS — APPLICATION:
- Identify narrative structure: orientation, complication, resolution (Labov's model)
- Apply thematic narrative coding: what are the recurring narrative elements?
- Discuss narrative identity: how does the narrator construct their sense of self?
- Address performative aspects: what does the narrator want the listener to believe?
- Present representative narrative segments with analysis
- Discuss how individual narratives relate to collective or cultural narratives`;

  if (f.includes("ethnograph")) return `
ETHNOGRAPHIC ANALYSIS — APPLICATION:
- Describe cultural themes identified from immersive fieldwork data
- Analyse patterns of behaviour and their cultural meaning
- Apply insider/outsider perspective: what did participant observation reveal that interviews would not?
- Present thick description: detailed contextualised accounts of observed events
- Discuss researcher positionality and reflexivity throughout
- Connect micro-level observations to macro-level cultural patterns`;

  if (f.includes("case study")) return `
CASE STUDY ANALYSIS — APPLICATION:
- Conduct within-case analysis for each case before cross-case comparison
- Present a cross-case comparison table: rows = cases, columns = key dimensions/themes
- Apply pattern matching: do patterns in each case match the theoretical propositions?
- Discuss rival explanations and why the chosen interpretation is most plausible
- Address boundaries of the case: what is inside and outside the case?
- Generalise analytically (to theory) not statistically (to populations)`;

  // ── MIXED METHODS ────────────────────────────────────────────────────────────

  if (f.includes("sequential explanatory") || f.includes("mixed method")) return `
MIXED METHODS — APPLICATION:
- Clearly state the integration strategy: Sequential Explanatory (quant→qual explains), Sequential Exploratory (qual→quant tests), Concurrent Triangulation, or Embedded Design
- Present quantitative findings first (with all statistical outputs as specified for that method)
- Present qualitative findings second, explicitly connecting them to quantitative results
- Include an integration/triangulation chapter or section that explains convergences and discrepancies
- For Sequential Exploratory: describe how qualitative themes were translated into survey items or hypotheses
- Discuss the weighting: which strand is primary and how results are synthesised`;

  // Generic framework guidance
  if (framework && framework !== "none specified" && framework !== "N/A") return `
FRAMEWORK APPLICATION — "${framework}":
- Apply this framework systematically and completely — cover every component
- Support each analytical point with evidence and citations
- Do NOT just describe the framework — APPLY it to the specific context
- Present findings in a structured format (tables where appropriate)
- Evaluate implications and strategic significance of findings
- Identify limitations of the framework in this context`;

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { section, execution_plan, prior_sections_summary, citation_style, academic_level, model, settings, brief_text, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiModel = model || "google/gemini-2.5-flash";
    const density = getCitationDensity(section.title);
    const wordsInK = section.word_target / 1000;
    // Extract advanced settings with defaults
    const formalityLevel = settings?.formalityLevel || 4;
    const hedgingIntensity = settings?.hedgingIntensity || "Medium";
    const firstPerson = settings?.firstPerson || false;
    const sentenceComplexity = settings?.sentenceComplexity || "Mixed";
    const transitionStyle = settings?.transitionStyle || "Formal connectors";
    const paragraphLength = settings?.paragraphLength || "Medium";
    const sourceDateFrom = settings?.sourceDateFrom || "2015";
    const sourceDateTo = settings?.sourceDateTo || "2025";
    const useSeminalSources = settings?.useSeminalSources !== false;
    const analysisDepth = settings?.analysisDepth || "Deep Critical";
    const technicalDensity = settings?.technicalDensity || 3;
    // Content & quality settings
    const totalCitationsOverride = settings?.totalCitations > 0 ? settings.totalCitations : null;
    // Use per-section citation_count, then global override proportional share, then auto density
    const citTarget = section.citation_count ||
      (totalCitationsOverride ? Math.round(totalCitationsOverride * wordsInK / Math.max((execution_plan?.total_words || 3000) / 1000, 1)) : null) ||
      Math.round(density.recommended * wordsInK);
    const citMin = Math.round(density.min * wordsInK);
    const citMax = Math.round(density.max * wordsInK);
    const includeImages = settings?.includeImages !== false;
    const imageCount = settings?.imageCount || 0;
    const imageTypes: string[] = settings?.imageTypes || [];
    const includeTables = settings?.includeTables !== false;
    const tableCount = settings?.tableCount || 0;
    const statisticalSourceCount = settings?.statisticalSourceCount || 0;
    const preferredDataSources: string[] = settings?.preferredDataSources || [];
    const chartComplexity = settings?.chartComplexity || 3;
    const figureNumbering = settings?.figureNumbering || "Sequential";

    const levelExpectations = getLevelExpectations(academic_level || "Undergraduate");
    const frameworkRules = getFrameworkRules(section.framework || "");

    const systemPrompt = `${getZoeBrain("write")}

═══════════════════════════════════════════════
CURRENT TASK
═══════════════════════════════════════════════
You are generating one section of a larger academic assessment. Write THIS section — and only this section — completely. It must be a complete, polished, submission-ready piece of academic writing at ${levelExpectations.depth} level. Every instruction below is non-negotiable.

═══════════════════════════════════════════════
SECTION SPECIFICATION
═══════════════════════════════════════════════
Section title: ${section.title}
Academic level: ${academic_level || "Undergraduate"}
Word target: EXACTLY ${section.word_target} words (±1% tolerance: ${Math.floor(section.word_target * 0.99)}–${Math.ceil(section.word_target * 1.01)} words)
Citation style: ${citation_style || "Harvard"}
Framework to apply: ${section.framework || "none specified"}
A+ criteria: ${section.a_plus_criteria || "Critical analysis, evidence-based, well-structured"}
Purpose and scope: ${section.purpose_scope || "See brief and execution plan"}

${frameworkRules}

═══════════════════════════════════════════════
ACADEMIC LEVEL AND CRITICAL THINKING
═══════════════════════════════════════════════
Level: ${levelExpectations.depth}
Critical thinking requirement: ${levelExpectations.criticalThinking}
Analysis guidance: ${levelExpectations.analysisGuidance}

Analysis depth setting: ${analysisDepth}
${analysisDepth === "Deep Critical"
  ? "Every analytical point must: (1) state the finding clearly, (2) explain WHY it matters in this context, (3) evaluate the implications for theory and practice, (4) connect to the broader argument of the work. Description without evaluation is not acceptable at this level."
  : analysisDepth === "Standard"
  ? "Provide thorough analysis with evidence-based evaluation throughout. Balance description with critical evaluation. Every claim must be justified."
  : "Provide a clear and accurate overview of key points with structured explanation and some critical comment where relevant."}

Writing must not be descriptive. It must be:
— Analytical: examine causes, effects, interactions, and relationships between ideas
— Logical: construct arguments step by step with clear, traceable reasoning
— Critical: challenge assumptions, interrogate evidence, identify limitations and contradictions
— Evaluative: assess significance, weigh competing perspectives, make well-reasoned judgements
— Synthetic: bring together multiple sources to build an original, coherent argument

═══════════════════════════════════════════════
WRITING STANDARDS — NON-NEGOTIABLE
═══════════════════════════════════════════════
Produce a rigorous academic response written in formal UK English, maintaining a third-person voice throughout with no contractions. The work must demonstrate sophisticated critical evaluation, theoretical integration, and precise disciplinary terminology, synthesising complex ideas rather than offering descriptive narration. The argument must be coherent, analytically robust, and grounded in high-quality, contemporary research, incorporating empirical data and relevant statistics to support nuanced and balanced discussion. Well-developed scholarly examples must be included where appropriate, and key concepts must be clearly and precisely defined. Differences and similarities between theoretical perspectives must be examined to provide deeper analytical insight. Frameworks must be critically appraised in relation to their strengths, limitations, assumptions, practical applicability, and relevance to professional practice. Evidence must be interrogated rather than accepted uncritically, with explicit connections drawn between theory, research, and practice to demonstrate mature scholarly engagement. Focus on depth, specificity, and quality over speed.

Numbers must be written in numerals (1, 2, 3, percentages as %) not words — except when a number begins a sentence. Abbreviations such as "e.g.", "i.e.", and "etc." must be avoided. Do not use bullet points or lists anywhere in this section. All analytical content must be expressed in fully developed paragraphs.

PUNCTUATION — NON-NEGOTIABLE: NEVER use em dashes (—) or en dashes (–) as punctuation substitutes. Where a comma, colon, semicolon, or parenthetical clause is appropriate, use those instead. Use only: commas, full stops, colons, semicolons, parentheses, and hyphens for compound words.

CITATION COVERAGE — NON-NEGOTIABLE: 90% of all content must be cited. You must cite any information, idea, theory, statistic, or material that did not originate from you — unless it is common knowledge (widely known facts, generally accepted information, well-established historical facts). EVERY sentence that contains borrowed material must be cited. Place citations IMMEDIATELY after the information they support, before the full stop. If an entire paragraph draws on one source, still cite within every 1–2 sentences — do not leave a single citation at the end as if it covers the whole paragraph. At least 2 in every 3 paragraphs must contain citations. A paragraph that asserts facts, theories, or findings without citation will fail at A+ standard.

EMPIRICAL DATA — MANDATORY: Every factual or statistical claim must be backed by a specific cited figure from a verifiable source. Do not write "studies show..." or "research suggests..." without citing the specific study, author, and year. Where data exists from statistical organisations (${preferredDataSources.length > 0 ? preferredDataSources.slice(0, 5).join(", ") : "Statista, World Bank, OECD, IMF"}), use it with precise figures (e.g. "GDP growth fell to 2.3% in 2023 (IMF, 2024)"). Vague generalisations unsupported by data are not acceptable.

${firstPerson ? 'First person is permitted where appropriate: "I argue", "I contend", "this analysis suggests" — use authorial voice where it adds precision.' : 'Strictly third-person voice throughout. No "I", "we", "my", "our" unless directly quoting a source.'}

Passive voice must not exceed 30% of sentences. Prefer active constructions with a clear human agent performing the action. Do not write "This essay will..." or "This section examines..." outside the Introduction section.

═══════════════════════════════════════════════
CITATION REQUIREMENTS — NON-NEGOTIABLE
═══════════════════════════════════════════════
All sources must be genuine, verifiable, and searchable via Google. Fictional, fabricated, or unverifiable references are strictly prohibited. No exceptions.

THE 90% RULE — MANDATORY BUT HONEST:
90% of all content in this section must be cited. Academic writing is built on evidence from others — any idea, finding, statistic, theory, claim, interpretation, or argument that did not originate in your own analysis MUST be cited. Uncited prose is a failure at A+ standard.

CRITICAL BALANCE — QUALITY OVER MECHANICAL COMPLIANCE:
The 90% rule means "wherever there is borrowed material, cite it honestly" — NOT "insert citations into every sentence regardless of whether they genuinely support the claim." Do NOT fabricate, force, or misrepresent citations to hit a number. Every citation must genuinely support the specific point being made: the cited source must actually say what you are claiming it says. A citation that misrepresents, stretches, or has nothing to do with the source is an academic integrity violation and is worse than no citation at all. Your own analytical conclusions drawn from evidence you have already cited do not need a second citation — that is your own thinking. Logical transitions, syntheses of previously-cited ideas, and interpretive commentary are yours and should not be artificially padded with citations.

CITATION DENSITY — TARGET:
— Minimum: ${density.min} citations per 1,000 words
— Recommended: ${density.recommended} citations per 1,000 words
— Target for this section (${section.word_target} words): ${citMin}–${citMax} in-text citations, aiming for ~${citTarget}
— At least 2 in every 3 consecutive paragraphs must contain citations. No paragraph that makes factual or theoretical claims may be left entirely uncited.

WHEN TO CITE — APPLY EVERY RULE:
1. IMMEDIATELY after the information: place the citation directly after the word, phrase, or sentence it supports — BEFORE the full stop where possible. Example: "Revenue grew by 14% (IMF, 2023)." not "Revenue grew by 14%. (IMF, 2023)"
2. IN EVERY SENTENCE CONTAINING BORROWED MATERIAL: if a paragraph summarises or paraphrases one source throughout, still cite every 1–2 sentences within that paragraph — do NOT leave a citation only at the end.
3. WHEN IN DOUBT: if you are uncertain whether information is common knowledge, cite it. The cost of an unnecessary citation is zero; the cost of a missing one is a fail.
4. EVERY in-text citation in this section must have a corresponding entry in the reference list.

WHAT DOES NOT NEED A CITATION (common knowledge only):
— Widely known facts: "The sun rises in the east."
— Generally accepted information: "Smoking can be harmful to health."
— Well-established historical overviews that appear in dozens of sources without dispute: "George Washington was the first US President."
— Your own original synthesis, interpretation, or analytical conclusion drawn from the evidence you have already cited.
Everything else — every theory, every framework, every statistic, every empirical claim, every research finding — MUST be cited.

Citations must be varied in format and integrated naturally into the prose using constructions such as:
— "(Author, Year)" — parenthetical, before full stop
— "Author (Year) argued that…"
— "Author (Year) contended that…"
— "Author (Year) demonstrated that…"
— "According to Author (Year)…"
— "As stated by Author (Year)…"
— "Author (Year) maintained that…"
— "Author (Year) revealed how…"
— "Author (Year) emphasised that…"

Citations must be substantively integrated into the analytical discussion — not always at the end of a sentence. Vary placement: mid-sentence, at the end before the full stop, and as narrative subject ("Smith (2021) demonstrated that..."). Never stack two citations consecutively without analysis between them.

In Harvard style, always use "and" rather than "&" for multiple authors (e.g., "Smith and Jones, 2020" — never "Smith & Jones, 2020").

ET AL. THRESHOLD:
— Harvard/APA: Use "et al." for 3+ authors in-text (e.g., "Smith et al., 2021"). List ALL authors in the reference list.
— MLA: Use "et al." for 4+ authors in-text. List all authors in the reference list.
— Vancouver/IEEE: Cite by number [1]; list all authors in the reference list.
— OSCOLA/Chicago Notes: List all authors in footnotes; use shortened form on repeat citation.
— 'Ibid.' is only permitted in Chicago Notes-Bibliography style. All other styles must repeat the full in-text citation on every use.

Source quality:
— Peer-reviewed journals: 50–60% of sources
— Academic books: 20–30%
— Industry reports and white papers: 10–15%
— Conference papers: 5–10%
— Publication date range: ${sourceDateFrom}–${sourceDateTo}
${useSeminalSources ? `— Seminal foundational works published before ${sourceDateFrom} are permitted where they established key theoretical positions. Flag these: (Author, Year [seminal]).` : `— Do NOT use sources published before ${sourceDateFrom}.`}
— Do not cite the same source more than twice in this section
— Prefer sources with high academic citation counts; avoid obscure, non-peer-reviewed, or unreliable sources
${statisticalSourceCount > 0 ? `— Include at least ${Math.ceil(statisticalSourceCount * wordsInK / Math.max((execution_plan?.total_words || 3000) / 1000, 1))} statistical or empirical data sources with real, verifiable figures.` : ""}
${preferredDataSources.length > 0 ? `— PREFERRED DATA SOURCES: Prioritise statistics and data from the following organisations where relevant: ${preferredDataSources.join(", ")}. Cite them explicitly within the text.` : ""}

Do NOT include a reference list or bibliography at the end of this section. In-text citations only. The reference list will be compiled as a separate, final document section.

═══════════════════════════════════════════════
STRUCTURE AND FORMATTING
═══════════════════════════════════════════════
The section must consist of fully developed paragraphs organised under a clear, academically appropriate heading (the section title). No bullet points, numbered lists, or sub-lists anywhere.

Paragraph structure:
— Length preference: ${paragraphLength} — ${paragraphLength === "Short" ? "2–4 sentences per paragraph" : paragraphLength === "Long" ? "6–12 sentences per paragraph" : "mix of short (2–4 sentences), medium (4–7 sentences), and occasional longer (7–10 sentence) paragraphs to vary rhythm"}
— Never open a paragraph by restating the conclusion of the previous paragraph
— Each paragraph must advance the argument — never repeat prior content
— Transition style: ${transitionStyle}
— Do not start more than 2 paragraphs with "The" in this section
— Do not write 3 consecutive sentences beginning with the same word

Figures and tables (where applicable):
— Embed figures and tables within the relevant analytical passage — never place them at the end
— Sequence: (1) analytical paragraph introducing the figure/table → (2) heading → (3) figure/table content → (4) interpretation → (5) continuation of analysis
— Number figures and tables in sequence: Figure 1, Figure 2, Table 1, Table 2, etc.
${includeImages
  ? `— FIGURES: ${imageCount > 0 ? `Include approximately ${imageCount} figure${imageCount > 1 ? "s" : ""}` : "Include figures where they meaningfully add analytical value"}.${imageTypes.length > 0 ? ` Preferred types: ${imageTypes.join(", ")}.` : ""}
  Write a placeholder on its own line: [FIGURE X: brief description — chart type], followed immediately by the caption BELOW the placeholder: "Figure X. [Descriptive title]. [Source: cite source]. N = [sample size if applicable]."
  FIGURE NUMBERING: Use ${figureNumbering === "Chapter-based" ? "chapter-based numbering (e.g. Figure 3.1, Figure 3.2 for chapter 3)" : "sequential numbering across the whole document (Figure 1, Figure 2, Figure 3...)"}.
  CROSS-REFERENCE LANGUAGE: When introducing a figure in text, write "As illustrated in Figure X..." or "Figure X presents..." or "As shown in Figure X..." — never place a figure without a textual introduction.
  CHART COMPLEXITY LEVEL: ${chartComplexity} — ${
    chartComplexity <= 1
      ? "MINIMAL: Clean chart, no gridlines, minimal axis labels, title only."
      : chartComplexity === 2
      ? "STANDARD: Gridlines at major intervals, labelled axes with units, data value labels on key elements, legend, title, figure number."
      : chartComplexity === 3
      ? "FULL ACADEMIC: All Standard elements plus error bars (95% CI), significance brackets with p-values or asterisks (* p<0.05, ** p<0.01, *** p<0.001), sample size annotations (n=X), source note below caption."
      : "PUBLICATION-READY: All Full Academic elements. State that the chart must be in vector SVG format with CMYK colour mode option, font embedded, and scalable without quality loss — submission-ready for academic journals."
  } Describe the required complexity level in the figure placeholder.
  AUTO-SELECT THE CORRECT CHART TYPE: Bar chart (grouped) for group comparisons/ANOVA/t-test; Bar chart (stacked) for composition over categories; Line chart for time series/longitudinal/trends; Scatter plot for correlation/regression (add regression line and confidence band); Box plot for group distributions and non-parametric comparisons; Histogram for frequency distributions (add normal curve overlay if testing normality); Forest plot for meta-analysis effect sizes; Heatmap/correlation matrix for factor analysis and correlation tables; Kaplan-Meier curve for survival analysis; ROC curve for logistic regression; Radar/Spider chart for multi-attribute comparisons; Funnel plot for meta-analysis publication bias; Sankey/Alluvial diagram for flow between categories. Always state the chart type in the figure placeholder.`
  : "— Do NOT include figures or images in this section."}
${includeTables
  ? `— TABLES: ${tableCount > 0 ? `Include approximately ${tableCount} formatted table${tableCount > 1 ? "s" : ""}` : "Include tables where data comparison or structured information genuinely adds value"}. Use markdown table format with clear column headers. Place the caption ABOVE the table (academic convention): "Table X. [Descriptive title]." Use ${figureNumbering === "Chapter-based" ? "chapter-based numbering (Table 3.1, Table 3.2...)" : "sequential numbering (Table 1, Table 2...)"}. When introducing a table in text, write "Table X presents..." or "As shown in Table X..." — always cross-reference before the table appears.`
  : "— Do not include tables in this section unless absolutely essential for data presentation."}

═══════════════════════════════════════════════
HUMANISING — MANDATORY
═══════════════════════════════════════════════
Humanise the content so it will not be flagged as AI-generated and reads as authored by a human being. That means changing voice, tone, rhythm, and phrasing. Write in a natural tone that anyone can understand, but keep it formal and academic. Use UK English, third-person voice, no contractions, and embed citations throughout. Use varied but accessible sentence structures and maintain an authentic, engaged flow. Avoid robotic phrasing. Make subtle stylistic adjustments to reflect a thoughtful, personal writing style. Write in present or past tense as appropriate to the nature of the content. Use rich, varied vocabulary — avoid repetitive phrasing, clichés, and AI-default wording. Incorporate precise, occasionally unexpected word choices where appropriate, while maintaining clarity and coherence.

Apply the following humanising transformations without exception:

1. SENTENCE STRUCTURE AND RHYTHM (highest priority):
Break the uniform structure of AI prose. Vary sentence length aggressively — place short, punchy sentences directly next to long, complex analytical ones. Do not allow 3 consecutive sentences to share a similar length or structure (±5 words). This variation in burstiness is the single most detectable difference between human and AI writing. Mix sentences of 6–12 words with sentences of 25–45 words. Never start a sentence the same way as the immediately preceding sentence.

2. REMOVE AI FINGERPRINTS:
Strip out every phrase that AI defaults to. This includes: "It is worth noting", "It is important to", "Furthermore", "Moreover", "In conclusion", "Delving into", "In the realm of", "It is evident that", "plays a crucial role", "robust framework", "multifaceted", "nuanced understanding", "paradigm shift", "holistic approach", "leveraging", "synergies", "cutting-edge", "groundbreaking", "game-changer", "tapestry", "myriad", "plethora", "advent of", "pave the way", "shed light on", "undeniable", "indispensable", "at the end of the day", and any sentence that opens by restating what was just said. Remove hollow filler affirmations entirely.

3. TRANSITIONS:
Replace mechanical logical connectors with natural, conversational bridges. Do not write "Additionally, it can be observed that" — write "That said," or "Which raises the question of" or simply begin a new thought without announcing it. Transitions must feel authored, not templated.

4. VOCABULARY:
Flatten the vocabulary slightly. AI overuses elevated synonyms to signal intelligence — choose the cleaner, more direct word unless the complex one is genuinely the right fit for this academic level. Avoid nominalisation where a verb is cleaner ("make a decision" → "decide"). Introduce phrasing that is correct but slightly unexpected — this is what makes writing feel authored rather than generated.

5. IMPERFECTION AND OPINION:
Introduce subtle authorial presence. Real academic writers hedge naturally, qualify claims informally, and occasionally let a perspective show. Passive constructions throughout signal AI — use active voice with a human agent behind it. Let the writing feel considered and personally engaged.

6. PARAGRAPH LOGIC:
AI builds paragraphs in rigid triads: claim, evidence, conclusion — repeat. Break this. Let some paragraphs be 2 sentences. Let an idea carry across a paragraph break. Let the structure follow the thought, not a template.

7. PERPLEXITY — LEXICAL UNPREDICTABILITY:
AI writing is statistically very predictable — each word tends to be the most likely next word. Introduce phrasing that is accurate and appropriate but slightly unexpected. When the obvious word is an AI cliché, use the second-best option instead. Vary every adjective and adverb — do not repeat the same descriptive word within 200 words unless it is a required discipline-specific term.

Sentence complexity preference: ${sentenceComplexity}
Hedging intensity: ${hedgingIntensity} — ${hedgingIntensity === "Low" ? "make direct claims with minimal hedging" : hedgingIntensity === "High" ? "use frequent, varied hedging (appears to suggest, may indicate, it could be argued, evidence seems to point toward)" : "balance direct claims with appropriate academic hedging"}
Formality level: ${formalityLevel}/5 (1 = conversational academic, 5 = highly formal)
Technical density: ${technicalDensity}/5 — ${technicalDensity <= 1 ? "write for a general educated audience; minimise jargon and define all specialist terms on first use" : technicalDensity === 2 ? "light use of field-specific terms; define uncommon jargon and avoid heavy technical language" : technicalDensity === 3 ? "standard academic technical register; use discipline-specific vocabulary appropriately without over-explanation" : technicalDensity === 4 ? "high technical density; assume reader familiarity with core disciplinary concepts and methodologies; use precise technical vocabulary throughout" : "specialist-level density; assume expert readership; deploy advanced terminology, field-specific shorthand, and discipline-specific methodological language without definition"}

═══════════════════════════════════════════════
QUALITY CRITERIA — ALL MUST BE MET
═══════════════════════════════════════════════
This section must satisfy all of the following without exception:
1. Clarity of argument — the central argument is immediately apparent and sustained throughout
2. Depth of analysis — ideas are examined beyond surface level; causes, effects, and implications are explored
3. Critical thinking — assumptions are challenged; evidence is interrogated; multiple perspectives are weighed
4. Proper synthesis — sources and ideas are integrated into a coherent argument, not simply reported
5. Coherence and structure — paragraphs flow logically; the section reads as a unified whole
6. Accurate citations and referencing — every citation is genuine, formatted correctly, and integrated naturally
7. Originality — the argument is constructed analytically, not copied or paraphrased in a generic way
8. Relevance to topic — every sentence connects to the section's purpose and the broader brief
9. Use of scholarly sources — sources are academic, credible, current, and appropriate to the level
10. Formal academic tone — no contractions, no colloquialisms, no casual phrasing
11. No contractions — "it is" not "it's", "do not" not "don't", "cannot" not "can't", throughout
12. Proper grammar and spelling — UK English spelling throughout; no grammatical errors
13. Logical flow of ideas — the argument builds progressively; no idea appears without preparation
14. Thorough research — the breadth and depth of source engagement reflects the academic level
15. Adherence to formatting guidelines — word count, paragraph structure, heading format, figure/table format all as specified
16. Balanced discussion — competing perspectives and counter-arguments are acknowledged and addressed
17. Use of data and statistics — empirical evidence is used to ground and substantiate analytical claims; all figures written in numerals
18. Ethical writing practice — no fabricated sources, no plagiarism, no falsification of data or citations

═══════════════════════════════════════════════
WORD COUNT — CRITICAL
═══════════════════════════════════════════════
BODY: Exactly ${section.word_target} words (±1%: ${Math.floor(section.word_target * 0.99)}–${Math.ceil(section.word_target * 1.01)} words). Count your words before outputting. If outside this range, revise until it meets the target. Word count does NOT include figure captions, table headings, or in-text citation brackets.

Do NOT include a ## References block at the end of this section. References are compiled separately at the document level. Write in-text citations only.`;

    const userPrompt = `SECTION: ${section.title}
TARGET WORDS: ${section.word_target}
FRAMEWORK: ${section.framework || "N/A"}
CITATIONS REQUIRED: ~${citTarget} (range: ${citMin}–${citMax})

─── SECTION PURPOSE & ANALYTICAL SCOPE ───
${section.purpose_scope || section.a_plus_criteria || "Not specified"}

─── LEARNING OUTCOMES TO DEMONSTRATE ───
${section.learning_outcomes || "Not specified — infer from assessment type and level"}

─── REQUIRED EVIDENCE & SOURCES ───
${section.required_inputs || "Use peer-reviewed academic sources appropriate to the topic and level"}

─── STRUCTURE & FORMATTING REQUIREMENTS ───
${section.structure_formatting || "Follow standard academic paragraph structure with clear topic sentences and logical flow"}

─── A+ MARKING CRITERIA ───
${section.a_plus_criteria || "Critical analysis, evidence-based argumentation, well-structured prose"}

─── NON-NEGOTIABLE CONSTRAINTS ───
${section.constraints || "No bullet points. Every claim cited. Word count ±1%."}

SUBJECT / COMPANY / TOPIC — CRITICAL:
${topic ? `The assessment is specifically about: ${topic}. You MUST write exclusively about this subject. Do NOT substitute or default to a different organisation, company, or topic.` : "Use the subject identified in the brief below."}

ORIGINAL BRIEF (ground ALL content in this — company names, data, requirements, and frameworks specified here must be followed exactly):
${brief_text ? brief_text.slice(0, 3000) : "See execution plan for context."}

ASSESSMENT CONTEXT:
${execution_plan ? JSON.stringify(execution_plan) : "Full assessment plan not provided"}

PRIOR SECTIONS SUMMARY (maintain terminology consistency — use the same terms, theoretical positions, and definitions established here):
${prior_sections_summary || "This is the first section."}

Write this section now. Follow EVERY instruction above precisely.

OUTPUT FORMAT:
Body text only — exactly ${section.word_target} words (±1%), with in-text citations throughout.
Do NOT include a ## References block. References are handled at the document level.
Do not write any preamble or commentary. Output the body text only, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("section-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
