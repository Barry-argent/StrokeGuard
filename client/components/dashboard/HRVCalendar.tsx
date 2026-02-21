"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface DayData {
  date: number;
  status: 'healthy' | 'borderline' | 'at-risk' | 'no-data';
  sdnn?: number;
  isToday?: boolean;
}

const statusConfig = {
  healthy: { bg: '#ECFDF5', text: '#10B981', label: 'Healthy' },
  borderline: { bg: '#FFFBEB', text: '#F59E0B', label: 'Borderline' },
  'at-risk': { bg: '#FEF2F2', text: '#EF4444', label: 'At Risk' },
  'no-data': { bg: '#F8FAFC', text: '#CBD5E1', label: 'No Data' },
};

const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HRVCalendar({ sessions = [] }: { sessions?: any[] }) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const today = new Date();
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Generate calendar data from real sessions
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Group sessions by day of the month
    const sessionsByDay = new Map<number, number[]>();
    sessions.forEach(s => {
      const d = new Date(s.startedAt);
      if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
        const day = d.getDate();
        if (s.avgPrv != null) {
          const existing = sessionsByDay.get(day) || [];
          sessionsByDay.set(day, [...existing, s.avgPrv]);
        }
      }
    });

    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = i + 1;
      const isToday = date === today.getDate();
      const dayPrvs = sessionsByDay.get(date);
      
      let status: DayData['status'] = 'no-data';
      let sdnn: number | undefined = undefined;

      if (dayPrvs && dayPrvs.length > 0) {
        // Use average of that day's sdnn readings
        sdnn = Math.round(dayPrvs.reduce((acc, val) => acc + val, 0) / dayPrvs.length);
        if (sdnn >= 50) status = 'healthy';
        else if (sdnn >= 20) status = 'borderline';
        else status = 'at-risk';
      }

      return { date, status, sdnn, isToday };
    });
  }, [sessions]);

  const handleMouseEnter = (day: DayData, event: React.MouseEvent) => {
    if (day.status !== 'no-data') {
      setHoveredDay(day);
      const rect = event.currentTarget.getBoundingClientRect();
      setMousePosition({ x: rect.left + rect.width / 2, y: rect.top });
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-[24px]">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4 relative">
        <h3 className="font-sans font-semibold text-[16px] text-[#0F172A]">PRV History</h3>
        <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
          <button className="p-1 hover:bg-slate-50 rounded transition-colors text-[#94A3B8]">
            <ChevronLeft size={16} />
          </button>
          <span className="font-sans font-medium text-[14px] text-[#0F172A]">{currentMonthName}</span>
          <button className="p-1 hover:bg-slate-50 rounded transition-colors text-[#94A3B8]">
            <ChevronRight size={16} />
          </button>
        </div>
        <div /> {/* Spacer for flex-between */}
      </div>

      {/* Legend row */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="font-sans text-[11px] text-[#64748B]">Healthy (SDNN ≥ 50ms)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span className="font-sans text-[11px] text-[#64748B]">Borderline (20–49ms)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="font-sans text-[11px] text-[#64748B]">At Risk (&lt; 20ms)</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="relative">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayHeaders.map((day) => (
            <div key={day} className="h-6 flex items-center justify-center">
              <span className="font-sans font-medium text-[12px] text-[#94A3B8]">{day}</span>
            </div>
          ))}
        </div>
        
        {/* Date Cells */}
        <div className="grid grid-cols-7 gap-y-2 place-items-center">
          {calendarData.map((day) => {
            const config = statusConfig[day.status];
            return (
              <div
                key={day.date}
                className="relative w-[36px] h-[36px] flex items-center justify-center rounded-[8px] cursor-pointer transition-opacity hover:opacity-80"
                style={{ 
                  backgroundColor: config.bg,
                  border: day.isToday ? '2px solid #0EA5E9' : 'none' 
                }}
                onMouseEnter={(e) => handleMouseEnter(day, e)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <span className={`font-sans text-[13px] ${day.isToday ? 'font-bold' : 'font-medium'}`} style={{ color: config.text }}>
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>

        {/* Hover Tooltip */}
        {hoveredDay && (
          <div 
            className="fixed z-50 bg-white rounded-lg border border-[#E2E8F0] px-3 py-2 pointer-events-none shadow-[0_4px_16px_rgba(0,0,0,0.08)]" 
            style={{ left: mousePosition.x, top: mousePosition.y - 60, transform: 'translateX(-50%)' }}
          >
            <p className="font-sans font-semibold text-xs text-[#0F172A] mb-0.5">{today.toLocaleString('default', { month: 'short' })} {hoveredDay.date}</p>
            <p className="font-mono text-xs" style={{ color: statusConfig[hoveredDay.status].text }}>
              {hoveredDay.sdnn} ms
            </p>
            <p className="font-sans text-[11px] text-[#64748B]">{statusConfig[hoveredDay.status].label}</p>
          </div>
        )}
      </div>
    </div>
  );
}
