// JD结构化输出类型
export interface JDRequirement {
  ksaType: 'knowledge' | 'skill' | 'ability' | 'other';
  description: string;
  priority: 'must_have' | 'nice_to_have';
  mappedDimension: string;
  targetLevel: number;
}

export interface DimensionWeight {
  dimensionId: string;
  weight: number;
}

export interface JDStructured {
  jobTitle: string;
  jobFamily: 'technical' | 'managerial' | 'functional';
  requirements: JDRequirement[];
  dimensionWeights: DimensionWeight[];
}

// 简历结构化输出类型
export interface Experience {
  company: string;
  role: string;
  period: string;
  rawText: string;
}

export interface BasicInfo {
  name: string | null;
  gender: string | null;    // 红线字段，仅展示
  age: number | null;       // 红线字段，仅展示
  phone: string | null;
  email: string | null;
}

export interface ResumeStructured {
  basicInfo: BasicInfo;
  experiences: Experience[];
  skills: string[];
  education: string[];
}

// 维度模板类型
export interface BehaviorAnchor {
  level: number;
  description: string;
}

export interface DimensionTemplateDTO {
  id: string;
  name: string;
  dimensionKey: string;
  jobFamily: string;
  verifiable: boolean;
  maxScore: number;
  weight: number;
  anchors: BehaviorAnchor[];
}

// 评分类型
export interface DimensionScore {
  weight?: number;
  dimensionId: string;
  dimensionName: string;
  candidateLevel: number;
  requiredLevel: number;
  evidence: string;
  requiredLevelReason: string;
  candidateLevelReason: string;
  verifiable: boolean;
  confidence: 'high' | 'medium' | 'low';
  gapNote?: string;
}

export interface GapItem {
  dimensionId: string;
  dimensionName: string;
  gapType: 'low_score' | 'unverifiable';
  description: string;
  requirementReference: string;
  candidateActual: string;
  whatIsMissing: string;
  dimensionDetail?: DimensionScore;
}

export interface RiskItem {
  type: string;
  description: string;
}

export interface ScoreResult {
  overallMatch: number;
  dimensionScores: DimensionScore[];
  gaps: GapItem[];
  risks: RiskItem[];
}

// 面试问题类型
export interface InterviewQuestionDTO {
  id?: string;
  dimensionId: string;
  dimensionName?: string;
  gapType: 'low_score' | 'unverifiable';
  question: string;
  whatToListenFor: string;
}

// 完整报告类型
export interface MatchReport {
  scoringVersion?: number;
  candidateName: string;
  jobTitle: string;
  overallMatch: number;
  pjMatch: number;       // P-J Fit: 可验证维度(1-5)的匹配度
  poMatch: number;       // P-O Fit: 待验证维度(6-7)的匹配度
  dimensionScores: DimensionScore[];
  gaps: GapItem[];
  risks: RiskItem[];
  interviewQuestions: InterviewQuestionDTO[];
  disclaimer: string;
}

// 候选人简要信息
export interface CandidateBrief {
  id: string;
  name: string;
  matchScore: number | null;
  status: string;
  createdAt: string;
}

// 岗位简要信息
export interface JobBrief {
  id: string;
  title: string;
  jobFamily: string;
  candidateCount: number;
  createdAt: string;
}
