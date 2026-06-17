"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { BarChart3 } from "lucide-react"

interface DayData {
  date: string
  count: number
}

interface Props {
  data: DayData[]
  loading: boolean
}

function formatDateHeader(raw: unknown): string {
  if (typeof raw !== "string") return ""
  // The API returns ISO yyyy-mm-dd strings. Build the Date as local time
  // (not UTC, which would shift the day in negative UTC offsets) so the
  // tooltip matches what the user sees on the calendar.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const dateLabel = formatDateHeader(payload[0]?.payload?.date)
  return (
    <div
      className="text-sm"
      style={{
        background: "#ffffff",
        border: "2px solid #2C2A28",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#2C2A28",
        boxShadow: "2px 3px 8px rgba(44,42,40,0.12)",
      }}
    >
      {dateLabel && <p className="font-medium">{dateLabel}</p>}
      <p style={{ color: "#D86B5A" }}>{payload[0].value} emails sorted</p>
    </div>
  )
}

export default function ActivityChart({ data, loading }: Props) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5" style={{ color: "#D86B5A" }} />
        <h3 className="text-lg font-semibold text-[#2C2A28]">Emails Sorted (30 Days)</h3>
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center" style={{ color: "#5A5753" }}>Loading...</div>
      ) : data.length === 0 || data.every((d) => d.count === 0) ? (
        <div className="flex h-64 items-center justify-center" style={{ color: "#5A5753" }}>No sorting activity yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={data} barCategoryGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5DFD3" />
            <XAxis
              dataKey="date"
              tickFormatter={() => ""}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#5A5753" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(216,107,90,0.12)" }} />
            <Bar dataKey="count" fill="#D86B5A" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
