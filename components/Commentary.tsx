'use client';

/**
 * Commentary
 *
 * Renders a chronological, plain-English narrative of pipeline events.
 * Each line: timestamp (HH:MM:SS) + lucide icon + sentence.
 *
 * Auto-scrolls to newest line only when the user is near the bottom
 * (scrollTop + clientHeight >= scrollHeight - 80), mirroring EventLog's
 * gated auto-scroll behavior.
 */

import React, { useEffect, useRef } from 'react';
import {
  Brain,
  Sprout,
  Expand,
  Bot,
  Search,
  Star,
  Filter,
  Tag,
  Layers,
  MapPin,
  CheckCircle,
  List,
  Dot,
} from 'lucide-react';
import type { RunEvent } from '@/lib/events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Clustering stage name -> friendly sentence
// ---------------------------------------------------------------------------

const CLUSTERING_STAGE_SENTENCES: Record<string, string> = {
  '01-classify': 'Clustering 1/10: classifying keywords by topic.',
  '02-split-oversized': 'Clustering 2/10: splitting oversized groups into focused clusters.',
  '03-serp-bucket': 'Clustering 3/10: grouping keywords that share search results into topics.',
  '04-merge-duplicates': 'Clustering 4/10: merging duplicate and near-duplicate clusters.',
  '05-titles': 'Clustering 5/10: writing SEO titles for each topic.',
  '06-merge-similar-titles': 'Clustering 6/10: merging clusters with overlapping titles.',
  '07-page-type': 'Clustering 7/10: assigning page type to each cluster.',
  '08-score': 'Clustering 8/10: scoring clusters by SEO opportunity.',
  '09-rank': 'Clustering 9/10: ranking topics by lead value.',
  '10-select': 'Clustering 10/10: selecting the final page set.',
};

// ---------------------------------------------------------------------------
// Event -> sentence
// ---------------------------------------------------------------------------

function toSentence(evt: RunEvent): string | null {
  switch (evt.stage) {
    case 'planner': {
      if (evt.type === 'decision') {
        if (evt.step === 'runResourceLanes') {
          return 'Planner: launching keyword generation for all selected offerings in parallel.';
        }
        return `Planner: ${evt.step} -- ${evt.rationale}`;
      }
      return null;
    }

    case 'angle-derivation': {
      if (evt.type === 'start') {
        return `Mapping the angles buyers search for ${evt.resourceId}.`;
      }
      if (evt.type === 'done') {
        return `Derived ${evt.count ?? 0} keyword angles.`;
      }
      return null;
    }

    case 'seed-gen': {
      if (evt.type === 'start') {
        return `Starting seed keyword generation for ${evt.resourceId}.`;
      }
      if (evt.type === 'done') {
        return `Generated ${evt.count ?? 0} seed keywords.`;
      }
      return null;
    }

    case 'broad-match': {
      if (evt.type === 'expand') {
        return `Expanded seed "${evt.seed}" into ${evt.produced} keyword ideas (DataForSEO).`;
      }
      if (evt.type === 'refeed') {
        return 'Re-fed the best kept keywords as new seeds to reach adjacent demand.';
      }
      return null;
    }

    case 'grade': {
      if (evt.type === 'batch') {
        return `Graded ${evt.graded} keywords -- kept ${evt.kept} (avg score ${evt.avgScore.toFixed(1)}), dropped ${evt.rejected}.`;
      }
      return null;
    }

    case 'mine-serp': {
      if (evt.type === 'keyword') {
        return `Analyzed Google SERP for "${evt.keyword}".`;
      }
      if (evt.type === 'patterns') {
        if (evt.triggered) {
          if (evt.modifiers.length > 0) {
            return `Found recurring competitor modifiers: ${evt.modifiers.join(', ')}.`;
          }
          return 'SERP trend analysis: no new patterns this step.';
        }
        return 'SERP trend analysis: no new patterns this step.';
      }
      if (evt.type === 'done') {
        return `SERP mining done: ${evt.serperQueries} queries, ${evt.competitorDomains} competitor domains scanned.`;
      }
      return null;
    }

    case 'name-expansion': {
      if (evt.type === 'done') {
        return `Pulled ${evt.variants} keyword variants around the exact offering name.`;
      }
      return null;
    }

    case 'pre-gate': {
      if (evt.type === 'done') {
        return `Pre-filtered junk: kept ${evt.kept}, dropped ${evt.dropped} before grading.`;
      }
      return null;
    }

    case 'clustering': {
      if (evt.type === 'stage') {
        if (evt.status === 'start') {
          const sentence = CLUSTERING_STAGE_SENTENCES[evt.name];
          return sentence ?? `Clustering: ${evt.name}.`;
        }
        // status === 'done': emit nothing (or could append "Done." but spec says new line / omit)
        return null;
      }
      return null;
    }

    case 'geo': {
      if (evt.type === 'done') {
        return `Localized top topics into ${evt.kept} local page variants.`;
      }
      return null;
    }

    case 'run': {
      if (evt.type === 'complete') {
        return `Run complete: ${evt.selected} keywords, ${evt.pages} candidate pages, $${evt.spend.toFixed(4)}.`;
      }
      return null;
    }

    case 'cluster': {
      if (evt.type === 'done') {
        return `Clustered ${evt.count} keyword groups.`;
      }
      return null;
    }

    case 'score': {
      if (evt.type === 'done') {
        return `Scored ${evt.count} keyword clusters.`;
      }
      return null;
    }

    case 'select': {
      if (evt.type === 'done') {
        return `Selected ${evt.count} top clusters.`;
      }
      return null;
    }

    case 'lane': {
      if (evt.type === 'agent-step') {
        return `Lane agent step ${evt.step}: ${evt.tool} (${evt.detail}).`;
      }
      return null;
    }

    default: {
      // Fallback: <stage>: <detail>
      const withDetail = evt as { stage: string; detail?: string };
      const detail = withDetail.detail ?? JSON.stringify(evt);
      return `${withDetail.stage}: ${detail}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Icon per stage/phase group
// ---------------------------------------------------------------------------

interface StageIconProps {
  stage: string;
}

function StageIcon({ stage }: StageIconProps) {
  const size = 12;
  switch (stage) {
    case 'planner':
      return <Brain size={size} aria-hidden="true" className="text-primary flex-shrink-0" />;
    case 'seed-gen':
    case 'angle-derivation':
      return <Sprout size={size} aria-hidden="true" className="text-warning flex-shrink-0" />;
    case 'broad-match':
      return <Expand size={size} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />;
    case 'lane':
      return <Bot size={size} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />;
    case 'mine-serp':
      return <Search size={size} aria-hidden="true" className="text-warning flex-shrink-0" />;
    case 'grade':
      return <Star size={size} aria-hidden="true" className="text-success flex-shrink-0" />;
    case 'pre-gate':
      return <Filter size={size} aria-hidden="true" className="text-warning flex-shrink-0" />;
    case 'name-expansion':
      return <Tag size={size} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />;
    case 'clustering':
      return <Layers size={size} aria-hidden="true" className="text-primary flex-shrink-0" />;
    case 'geo':
      return <MapPin size={size} aria-hidden="true" className="text-primary flex-shrink-0" />;
    case 'run':
      return <CheckCircle size={size} aria-hidden="true" className="text-success flex-shrink-0" />;
    case 'cluster':
    case 'score':
    case 'select':
      return <List size={size} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />;
    default:
      return <Dot size={size} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// NarrativeItem
// ---------------------------------------------------------------------------

interface NarrativeItem {
  ts: number;
  stage: string;
  sentence: string;
}

// ---------------------------------------------------------------------------
// Commentary
// ---------------------------------------------------------------------------

interface CommentaryProps {
  events: RunEvent[];
}

export default function Commentary({ events }: CommentaryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gated auto-scroll: only scroll when near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-on-surface-muted">
        Waiting for the run to start...
      </div>
    );
  }

  // Build narrative items -- skip events that produce no sentence
  const items: NarrativeItem[] = [];
  for (const evt of events) {
    const sentence = toSentence(evt);
    if (sentence !== null) {
      items.push({ ts: evt.ts, stage: evt.stage, sentence });
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-on-surface-muted">
        Waiting for the run to start...
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-auto"
      style={{ height: '280px' }}
      role="log"
      aria-live="polite"
      aria-label="Pipeline commentary"
    >
      {items.map((item, idx) => (
        <div
          key={`${item.ts}-${item.stage}-${idx}`}
          data-testid="commentary-item"
          className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-border last:border-0 hover:bg-surface-muted"
        >
          {/* Icon */}
          <span className="mt-0.5">
            <StageIcon stage={item.stage} />
          </span>
          {/* Timestamp */}
          <span className="font-mono tabular-nums text-on-surface-muted flex-shrink-0 w-[60px]">
            {formatTs(item.ts)}
          </span>
          {/* Sentence */}
          <span className="text-on-surface flex-1 min-w-0">
            {item.sentence}
          </span>
        </div>
      ))}
    </div>
  );
}
