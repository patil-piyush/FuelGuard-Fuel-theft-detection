import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatClockTime } from '../lib/format'
import EmptyState from './EmptyState'
import { Gauge } from 'lucide-react'

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-hairline bg-panel-raised px-2.5 py-1.5 text-xs shadow-panel">
      <p className="text-text-faint">{formatClockTime(label)}</p>
      <p className="readout text-signal-blue">{payload[0].value} km/h</p>
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array<{received_at: string, speed_kmph: number|null}>} props.data
 */
export default function SpeedChart({ data }) {
  const points = data
    .filter((d) => d.speed_kmph !== null && d.speed_kmph !== undefined)
    .map((d) => ({ time: d.received_at, speed: d.speed_kmph }))
    .reverse()

  if (points.length === 0) {
    return <EmptyState icon={Gauge} title="Speed data unavailable" detail="No speed readings for this period." />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#232E45" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatClockTime}
          stroke="#5C6680"
          tick={{ fontSize: 11, fill: '#8992A9' }}
          tickLine={false}
          axisLine={{ stroke: '#232E45' }}
        />
        <YAxis
          stroke="#5C6680"
          tick={{ fontSize: 11, fill: '#8992A9' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip content={<TooltipContent />} />
        <Line
          type="monotone"
          dataKey="speed"
          stroke="#4C8DFF"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#4C8DFF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
