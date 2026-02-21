"use client";

import { Lightbulb, RotateCcw, ExternalLink, Bot } from 'lucide-react';

interface HealthTipsCardProps {
  aiAdvice?: string | null;
}

export function HealthTipsCard({ aiAdvice }: HealthTipsCardProps) {
  const isAI = !!aiAdvice;
  const tipText = aiAdvice || "Drinking 8 glasses of water daily helps maintain optimal blood volume and reduces the risk of clot formation. Proper hydration is a simple way to protect your brain.";
  
  return (
    <div className="bg-[#EFF6FF] rounded-[12px] border-none p-[16px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isAI ? <Bot size={16} className="text-[#0EA5E9]"/> : <Lightbulb size={16} className="text-[#0EA5E9]" />}
          <h3 className="font-sans font-semibold text-[13px] text-[#0284C7]">
            {isAI ? "AI Health Coach" : "Health Tips"}
          </h3>
        </div>
        <button className="text-[#0EA5E9] hover:opacity-80 transition-opacity">
          <RotateCcw size={14} />
        </button>
      </div>
      
      <p className="font-sans text-[13px] text-[#1E40AF] leading-relaxed mb-3">
        {tipText}
      </p>
      
      <div className="flex items-center gap-1">
        <span className="font-sans text-[10px] text-[#60A5FA]">
          Source: {isAI ? "StrokeGuard AI Clinical Reasoning" : "American Heart Association"}
        </span>
        {!isAI && <ExternalLink size={10} className="text-[#60A5FA] mb-1" />}
      </div>
    </div>
  );
}
