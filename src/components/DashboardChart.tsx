import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface ChartDataPoint {
  month: string; // "Jan", "Feb", etc.
  Falls: number;
}

interface DashboardChartProps {
  data: ChartDataPoint[];
  className?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-soft">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{payload[0].payload.monthName}</p>
        <p className="text-sm font-bold text-brand-primary mt-1">
          {payload[0].value.toLocaleString()} <span className="text-xs font-medium text-slate-400">Falls</span>
        </p>
      </div>
    );
  }
  return null;
};

export const DashboardChart: React.FC<DashboardChartProps> = ({ data, className = "w-full h-52" }) => {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -15,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284C7" stopOpacity={0.95}/>
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
            dy={8}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#E0F2FE', opacity: 0.4 }} />
          <Bar 
            dataKey="Falls" 
            fill="url(#blueGradient)" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
export default DashboardChart;
