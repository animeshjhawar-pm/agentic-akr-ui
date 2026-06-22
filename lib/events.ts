/**
 * RunEvent union type - mirrors agentic-akr src/trace/events.ts.
 * Defined locally to avoid cross-package imports.
 */

export interface PlannerDecisionEvent {
  ts: number;
  stage: 'planner';
  type: 'decision';
  step: string;
  rationale: string;
}

export interface StageStartDoneEvent {
  ts: number;
  stage: 'seed-gen' | 'angle-derivation';
  type: 'start' | 'done';
  resourceId: string;
  count?: number;
}

export interface BroadMatchExpandEvent {
  ts: number;
  stage: 'broad-match';
  type: 'expand';
  resourceId: string;
  seed: string;
  produced: number;
}

export interface BroadMatchRefeedEvent {
  ts: number;
  stage: 'broad-match';
  type: 'refeed';
  resourceId: string;
  refed: number;
  detail: string;
}

export interface LaneAgentStepEvent {
  ts: number;
  stage: 'lane';
  type: 'agent-step';
  resourceId: string;
  step: number;
  tool: string;
  rationale?: string;
  produced?: number;
  kept?: number;
  traceId?: string;
  detail: string;
}

export interface NameExpansionDoneEvent {
  ts: number;
  stage: 'name-expansion';
  type: 'done';
  resourceId: string;
  variants: number;
  detail: string;
}

export interface MineSerpDoneEvent {
  ts: number;
  stage: 'mine-serp';
  type: 'done';
  resourceId: string;
  serperQueries: number;
  competitorDomains: number;
  rankedKeywordPulls: number;
  rankedTermsPulled: number;
  trendsSpawned: number;
  trendsPatterns: number;
  patternKept?: number;
  competitorKept?: number;
  detail: string;
}

export interface MineSerpKeywordEvent {
  ts: number;
  stage: 'mine-serp';
  type: 'keyword';
  resourceId: string;
  keyword: string;
  titlesSeen: number;
  competitorDomains: number;
  rankedPulled: boolean;
  detail: string;
}

export interface MineSerpPatternsEvent {
  ts: number;
  stage: 'mine-serp';
  type: 'patterns';
  resourceId: string;
  triggered: boolean;
  modifiers: string[];
  candidateTerms: string[];
  traceId?: string;
  detail: string;
}

export interface GeoDoneEvent {
  ts: number;
  stage: 'geo';
  type: 'done';
  resourceId: string;
  heads: number;
  cities: number;
  combosTried: number;
  kept: number;
  detail: string;
}

export interface PreGateDoneEvent {
  ts: number;
  stage: 'pre-gate';
  type: 'done';
  resourceId: string;
  kept: number;
  dropped: number;
  detail: string;
}

export interface GradeBatchEvent {
  ts: number;
  stage: 'grade';
  type: 'batch';
  resourceId: string;
  graded: number;
  kept: number;
  rejected: number;
  outOfScope: number;
  avgScore: number;
  traceId?: string;
  detail: string;
}

export interface StageDoneEvent {
  ts: number;
  stage: 'cluster' | 'score' | 'select';
  type: 'done';
  count: number;
}

export interface ClusteringStageEvent {
  ts: number;
  stage: 'clustering';
  type: 'stage';
  name: string;
  status: 'start' | 'done';
  count?: number;
  detail: string;
}

export interface RunCompleteEvent {
  ts: number;
  stage: 'run';
  type: 'complete';
  pages: number;
  selected: number;
  spend: number;
}

export type RunEvent =
  | PlannerDecisionEvent
  | StageStartDoneEvent
  | BroadMatchExpandEvent
  | BroadMatchRefeedEvent
  | LaneAgentStepEvent
  | NameExpansionDoneEvent
  | MineSerpDoneEvent
  | MineSerpKeywordEvent
  | MineSerpPatternsEvent
  | GradeBatchEvent
  | StageDoneEvent
  | ClusteringStageEvent
  | GeoDoneEvent
  | PreGateDoneEvent
  | RunCompleteEvent;
