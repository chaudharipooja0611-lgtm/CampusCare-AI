import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const tip = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.08)', fontSize: 12 } }

export const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <div className={`card animate-fade-up p-5 ${className}`}>
    <h3 className="font-bold">{title}</h3>
    {subtitle && <p className="mb-3 text-xs text-ink-500">{subtitle}</p>}
    <div className="mt-2 h-64">{children}</div>
  </div>
)

export const TrendChart = ({ data }) => (
  <ResponsiveContainer>
    <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
      <defs><linearGradient id="trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c5cf0" stopOpacity={0.45} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={1} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
      <Tooltip {...tip} />
      <Area type="monotone" dataKey="complaints" stroke="#2f4aa6" strokeWidth={2.5} fill="url(#trend)" animationDuration={900} />
    </AreaChart>
  </ResponsiveContainer>
)

export const Donut = ({ data, colors }) => {
  const filtered = data.filter((d) => d.value > 0)
  if (!filtered.length) return <div className="grid h-full place-items-center text-sm text-ink-500">No data yet</div>
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} animationDuration={900}>
          {filtered.map((d) => <Cell key={d.name} fill={colors[d.name] || '#94a3b8'} />)}
        </Pie>
        <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export const Bars = ({ data, colors, horizontal }) => (
  <ResponsiveContainer>
    <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ left: horizontal ? 20 : -20, right: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={!horizontal} horizontal={horizontal ? false : true} />
      {horizontal ? <><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /></>
        : <><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /></>}
      <Tooltip {...tip} cursor={{ fill: '#f1f5f9' }} />
      <Bar dataKey="value" radius={[8, 8, 8, 8]} animationDuration={900}>
        {data.map((d) => <Cell key={d.name} fill={colors?.[d.name] || '#6366f1'} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
)
