import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: number; label: string };
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
  className?: string;
}

const colorMap = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
};

export default function StatCard({ title, value, subtitle, icon, color = 'indigo', className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl bg-white border border-slate-200 p-5 flex items-start gap-4', className)}>
      <div className={cn('rounded-xl p-3', colorMap[color])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 truncate">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
