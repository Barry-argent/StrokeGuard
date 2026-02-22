"use client";

import { Lightbulb, RotateCcw, ExternalLink, Sparkles, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface HealthTipsCardProps {
  aiAdvice?: string | null;
  onTaskComplete?: (taskTitle: string) => void;
  completedTasks?: string[];
}

const TIPS_CACHE_KEY = 'strokeguard_health_tips';
const TIPS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCachedTips(): string | null {
  try {
    const raw = localStorage.getItem(TIPS_CACHE_KEY);
    if (!raw) return null;
    const { tips, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > TIPS_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(TIPS_CACHE_KEY);
      return null;
    }
    return tips;
  } catch {
    return null;
  }
}

function setCachedTips(tips: string) {
  try {
    localStorage.setItem(TIPS_CACHE_KEY, JSON.stringify({ tips, timestamp: Date.now() }));
  } catch { /* ignore quota errors */ }
}

export function HealthTipsCard({ aiAdvice, onTaskComplete, completedTasks = [] }: HealthTipsCardProps) {
  const [fetchedTips, setFetchedTips] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchTips = useCallback(async (force = false) => {
    // Don't fetch if we already have AI advice from the polling system (e.g. YELLOW triage)
    if (aiAdvice && !force) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/internal/health-tips');
      if (res.ok) {
        const data = await res.json();
        if (data.tips) {
          setFetchedTips(data.tips);
          setCachedTips(data.tips);
        }
      }
    } catch (e) {
      console.error('[HealthTips] Fetch error:', e);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [aiAdvice]);

  // On mount: load from cache first, then fetch fresh tips
  useEffect(() => {
    const cached = getCachedTips();
    if (cached) {
      setFetchedTips(cached);
      setHasFetched(true);
    }
    // Always attempt a fresh fetch (will update in background)
    if (!aiAdvice) {
      fetchTips();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // The active tip source: real-time AI advice (triage) > fetched tips > null
  const activeTips = aiAdvice || fetchedTips;
  const isAI = !!activeTips;
  
  // Parse textual advice into context summary and actionable tasks
  const { summary, tasks } = useMemo(() => {
    if (!activeTips) {
      return { summary: '', tasks: [] };
    }
    
    // Look for markdown lists (- or * or 1.) to extract discrete actions
    const listRegex = /^(?:-|\*|\d+\.)\s+(.+)$/gm;
    const extractedTasks: string[] = [];
    let match;
    while ((match = listRegex.exec(activeTips)) !== null) {
      extractedTasks.push(match[1].trim());
    }

    if (extractedTasks.length > 0) {
      // Everything before the first list item is the summary
      const firstListIdx = activeTips.search(/^(?:-|\*|\d+\.)\s+/m);
      const summaryText = firstListIdx > 0 ? activeTips.substring(0, firstListIdx).trim() : '';
      return { summary: summaryText, tasks: extractedTasks };
    }

    // Fallback: split by sentence
    const sentences = activeTips.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);
    if (sentences.length > 1) {
      return { summary: sentences[0], tasks: sentences.slice(1) };
    }
    return { summary: '', tasks: sentences };
  }, [activeTips]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#FAFAFA] to-[#F8FAFC] rounded-[16px] p-4 sm:p-6 shadow-sm border border-[#E2E8F0] group transition-all duration-300 hover:shadow-md">
      {/* Subtle AI Glow if isAI */}
      {isAI && (
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none transition-all group-hover:bg-indigo-500/20" />
      )}
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          {isAI ? (
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Sparkles size={14} className="text-indigo-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center border border-orange-100">
              <Lightbulb size={14} className="text-orange-500" />
            </div>
          )}
          <h3 className="font-sans font-bold text-[14px] text-[#0F172A] tracking-tight">
            {isAI ? "AI Action Plan" : "Daily Goals"}
          </h3>
        </div>
        <button 
          onClick={() => fetchTips(true)} 
          disabled={isLoading}
          className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-50" 
          title="Refresh insight"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !activeTips && (
        <div className="space-y-3 mb-4 relative z-10">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100">
              <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state for first-time users with no tips yet */}
      {!isLoading && !activeTips && hasFetched && (
        <div className="text-center py-6 relative z-10">
          <p className="text-slate-400 text-sm mb-3">Complete your first scan to get personalized health tips.</p>
          <button
            onClick={() => fetchTips(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Try generating tips anyway →
          </button>
        </div>
      )}
      
      {summary && (
        <div className="relative z-10 mb-4 prose prose-sm prose-slate max-w-none prose-p:my-1 leading-relaxed text-[13px] text-slate-600">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-2 relative z-10 mb-5">
          {tasks.map((task, idx) => {
            const isDone = completedTasks.includes(task);
            
            return (
              <button
                key={idx}
                onClick={() => !isDone && onTaskComplete?.(task)}
                disabled={isDone}
                className={`flex items-start gap-3 w-full text-left p-2.5 rounded-xl border transition-all duration-200
                  ${isDone 
                    ? 'bg-emerald-50/50 border-emerald-100 opacity-60' 
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-[0_2px_8px_-4px_rgba(99,102,241,0.2)]'
                  }`}
              >
                <div className="pt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-500 transition-transform scale-110" />
                  ) : (
                    <Circle size={16} className="text-slate-300 transition-colors group-hover:text-indigo-300" />
                  )}
                </div>
                <div className={`font-sans text-[13px] leading-snug transition-all duration-300 flex-1 prose prose-sm max-w-none prose-p:my-0 prose-strong:font-semibold ${isDone ? 'text-slate-500 line-through prose-strong:text-slate-500' : 'text-slate-700 prose-strong:text-slate-800'}`}>
                  <ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>
                    {task}
                  </ReactMarkdown>
                </div>
              </button>
            )
          })}
        </div>
      )}
      
      <div className="flex items-center gap-1.5 relative z-10 mt-auto">
        <span className="font-sans font-semibold text-[9px] uppercase tracking-[0.05em] text-[#94A3B8]">
          Source: {isAI ? "StrokeGuard AI Engine" : "AHA Guidelines"}
        </span>
        {!isAI && <ExternalLink size={10} className="text-[#94A3B8]" />}
      </div>
    </div>
  );
}
