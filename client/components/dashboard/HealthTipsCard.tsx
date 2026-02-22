"use client";

import { Lightbulb, RotateCcw, ExternalLink, Sparkles, CheckCircle2, Circle } from 'lucide-react';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

interface HealthTipsCardProps {
  aiAdvice?: string | null;
  onTaskComplete?: (taskTitle: string) => void;
  completedTasks?: string[];
}

export function HealthTipsCard({ aiAdvice, onTaskComplete, completedTasks = [] }: HealthTipsCardProps) {
  const isAI = !!aiAdvice;
  
  // Intelligently parse textual advice into context summary and actionable tasks
  const { summary, tasks } = useMemo(() => {
    if (!aiAdvice) {
      return { 
        summary: '',
        tasks: [
          "Drink 8 glasses of water.", 
          "Take a 15 minute walk.", 
          "Check your blood pressure."
        ] 
      };
    }
    
    // Look for markdown lists (- or * or 1.) to extract discrete actions
    const listRegex = /^(?:-|\*|\d+\.)\s+(.+)$/gm;
    const extractedTasks = [];
    let match;
    while ((match = listRegex.exec(aiAdvice)) !== null) {
      extractedTasks.push(match[1].trim());
    }

    if (extractedTasks.length > 0) {
      return { 
        summary: aiAdvice.replace(listRegex, '').trim(), 
        tasks: extractedTasks 
      };
    }

    // Fallback: If no lists, try to split by sentence intelligently
    const sentences = aiAdvice.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);
    
    // If multiple sentences, use first one as summary, others as tasks
    if (sentences.length > 1) {
      return { summary: sentences[0], tasks: sentences.slice(1) };
    }
    
    // If just one sentence, no summary, just a single task
    return { summary: '', tasks: sentences };
  }, [aiAdvice]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#FAFAFA] to-[#F8FAFC] rounded-[16px] p-5 shadow-sm border border-[#E2E8F0] group transition-all duration-300 hover:shadow-md">
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
        <button className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1.5 rounded-md hover:bg-slate-100" title="Refresh insight">
          <RotateCcw size={14} />
        </button>
      </div>
      
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
