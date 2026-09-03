import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatClockTime } from '../lib/format'
import EmptyState from './EmptyState'
import { Fuel } from 'lucide-react'

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-hairline bg-panel-raised px-2.5 py-1.5 text-xs shadow-panel">
      <p className="text-text-faint">{formatClockTime(label)}</p>
      <p className="readout text-amber">{payload[0].value}%</p>
    </div>
  )
}

/**
 * @param {object} props
 * @param {Array<{received_at: string, fuel_level: number|null}>} props.data
 */
export default function FuelChart({ data }) {
  const points = data
    .filter((d) => d.fuel_level !== null && d.fuel_level !== undefined)
    .map((d) => ({ time: d.received_at, fuel: d.fuel_level }))
    .reverse()

  if (points.length === 0) {
    return (
      <EmptyState
        icon={Fuel}
        title="Fuel data unavailable"
        detail="No calibrated fuel readings yet for this period."
      />
    )
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
          domain={[0, 100]}
          stroke="#5C6680"
          tick={{ fontSize: 11, fill: '#8992A9' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip content={<TooltipContent />} />
        <Line
          type="monotone"
          dataKey="fuel"
          stroke="#F2A93B"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#F2A93B' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
