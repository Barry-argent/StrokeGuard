"use client";

import { CheckCircle, TrendingUp, AlertTriangle, Watch, Activity, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

// Native date utilities to replace date-fns
const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const isThisWeek = (date: Date) => {
  const today = new Date();
  const dayOfWeek = today.getDay(); 
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is sunday
  const startOfWeek = new Date(today.setDate(diff));
  startOfWeek.setHours(0,0,0,0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23,59,59,999);
  
  return date >= startOfWeek && date <= endOfWeek;
};

const formatTime = (date: Date) => {
  const hs = date.getHours().toString().padStart(2, '0');
  const ms = date.getMinutes().toString().padStart(2, '0');
  return `${hs}:${ms}`;
};

interface RecentActivityFeedProps {
  sessions: any[];
  completedTasks?: string[];
}

interface ActivityItem {
  id: string;
  type: 'fast-check' | 'risk-score' | 'spo2-dip' | 'watch-sync' | 'task-completed';
  title: string;
  description: string;
  time: string;
  dateObj: Date;
}

const getIconConfig = (type: ActivityItem['type']) => {
  switch (type) {
    case 'task-completed': return { icon: CheckCircle2, color: '#10B981', bg: '#D1FAE5' };
    case 'fast-check': return { icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' };
    case 'risk-score': return { icon: TrendingUp, color: '#0EA5E9', bg: '#EFF6FF' };
    case 'spo2-dip': return { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' };
    case 'watch-sync': return { icon: Watch, color: '#64748B', bg: '#F1F5F9' };
    default: return { icon: Activity, color: '#64748B', bg: '#F1F5F9' };
  }
};

export function RecentActivityFeed({ sessions, completedTasks = [] }: RecentActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');

  // Convert DB sessions into ActivityItems
  const sessionActivities: ActivityItem[] = sessions.map(s => {
    const isScan = s.mode === 'QUICK_CHECK' || s.mode === 'ACTIVE';
    const status = s.triageStatus;
    
    let title = isScan ? 'Camera Scan' : 'Activity';
    let desc = 'Vitals recorded';
    let type: ActivityItem['type'] = 'fast-check';

    if (status === 'RED') {
      title = 'Health Warning';
      desc = 'Abnormal vitals detected';
      type = 'spo2-dip';
    } else if (status === 'YELLOW') {
      title = 'Elevated Vitals';
      desc = 'Moderate risk detected';
      type = 'risk-score';
    } else if (status === 'GREEN') {
      title = 'Scan Clear';
      desc = 'All signs normal';
      type = 'fast-check';
    }

    return {
      id: s.id,
      type,
      title,
      description: desc,
      time: formatTime(new Date(s.startedAt)),
      dateObj: new Date(s.startedAt)
    };
  });

  // Convert completed tasks into ActivityItems (assuming they were completed "just now")
  const taskActivities: ActivityItem[] = completedTasks.map((taskText, idx) => ({
    id: `task-${idx}-${Date.now()}`,
    type: 'task-completed',
    title: 'Goal Completed',
    description: taskText,
    time: formatTime(new Date()), // Display as just completed
    dateObj: new Date()
  }));

  // Merge and sort
  const allActivities = [...taskActivities, ...sessionActivities].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  const filteredActivities = allActivities.filter(a => 
    activeTab === 'today' ? isToday(a.dateObj) : isThisWeek(a.dateObj)
  );

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans font-semibold text-[16px] text-[#0F172A]">Recent Activity</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-4 border-b border-[#F1F5F9]">
        <button
          onClick={() => setActiveTab('today')}
          className={`pb-3 font-sans text-[13px] border-b-2 transition-colors ${
            activeTab === 'today' 
              ? 'border-[#0EA5E9] text-[#0EA5E9] font-semibold' 
              : 'border-transparent text-[#94A3B8] font-medium'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setActiveTab('week')}
          className={`pb-3 font-sans text-[13px] border-b-2 transition-colors ${
            activeTab === 'week' 
              ? 'border-[#0EA5E9] text-[#0EA5E9] font-semibold' 
              : 'border-transparent text-[#94A3B8] font-medium'
          }`}
        >
          This Week
        </button>
      </div>

      {/* Activity List */}
      <div className="flex flex-col min-h-[150px]">
        {filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#94A3B8] text-[13px] font-sans py-8">
            No activity {activeTab === 'today' ? 'today' : 'this week'} yet
          </div>
        ) : (
          filteredActivities.map((activity, index) => {
            const { icon: Icon, color, bg } = getIconConfig(activity.type);
            return (
              <div 
                key={activity.id} 
                className={`flex items-center gap-4 py-[12px] ${
                  index !== filteredActivities.length - 1 ? 'border-b border-[#F1F5F9]' : ''
                }`}
              >
                <div 
                  className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center flex-shrink-0" 
                  style={{ backgroundColor: bg }}
                >
                  <Icon size={16} strokeWidth={2.5} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-medium text-[13px] text-[#334155] leading-snug">
                    {activity.title}
                  </p>
                  <p className="font-sans text-[12px] text-[#64748B] truncate">
                    {activity.description}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#94A3B8] flex-shrink-0 mt-1 self-start ml-auto">
                  {activity.time}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
