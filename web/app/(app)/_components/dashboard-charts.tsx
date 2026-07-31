"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type DepartmentBreakdown = { dept_name: string; count: number }
type ApplicationTrend = { month: string; count: number }
type GoalStatusSummary = { draft: number; in_progress: number; completed: number }

type Props = {
  departmentBreakdown: DepartmentBreakdown[]
  applicationTrend: ApplicationTrend[]
  goalStatusSummary: GoalStatusSummary
  goalCompletionRate: number
}

const DEPT_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 70%, 60%)",
  "hsl(190, 80%, 45%)",
  "hsl(330, 70%, 55%)",
  "hsl(60, 70%, 45%)",
]

const applicationTrendConfig = {
  count: {
    label: "申請件数",
    color: "hsl(221, 83%, 53%)",
  },
} satisfies ChartConfig

const goalStatusConfig = {
  draft: {
    label: "下書き",
    color: "hsl(220, 14%, 65%)",
  },
  in_progress: {
    label: "進行中",
    color: "hsl(221, 83%, 53%)",
  },
  completed: {
    label: "完了",
    color: "hsl(142, 71%, 45%)",
  },
} satisfies ChartConfig

export function DashboardCharts({
  departmentBreakdown,
  applicationTrend,
  goalStatusSummary,
  goalCompletionRate,
}: Props) {
  const deptConfig = Object.fromEntries(
    departmentBreakdown.map((d, i) => [
      d.dept_name,
      { label: d.dept_name, color: DEPT_COLORS[i % DEPT_COLORS.length] },
    ]),
  ) satisfies ChartConfig

  const goalStatusData = [
    { status: "draft", count: goalStatusSummary.draft, fill: goalStatusConfig.draft.color },
    {
      status: "in_progress",
      count: goalStatusSummary.in_progress,
      fill: goalStatusConfig.in_progress.color,
    },
    {
      status: "completed",
      count: goalStatusSummary.completed,
      fill: goalStatusConfig.completed.color,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 部署別従業員数 (Bar Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>部署別従業員数</CardTitle>
          <CardDescription>各部署の従業員数の内訳</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={deptConfig} className="h-[250px] w-full">
            <BarChart data={departmentBreakdown} layout="vertical">
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="dept_name"
                type="category"
                width={120}
                tickLine={false}
                axisLine={false}
              />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={4}>
                {departmentBreakdown.map((entry, index) => (
                  <Cell key={entry.dept_name} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* 申請件数推移 (Line Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>申請件数推移</CardTitle>
          <CardDescription>直近 6 か月の申請件数</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={applicationTrendConfig} className="h-[250px] w-full">
            <LineChart data={applicationTrend}>
              <CartesianGrid />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="count"
                type="monotone"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* 目標ステータス (Pie Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>目標ステータス</CardTitle>
          <CardDescription>全目標の進捗状況（完了率 {goalCompletionRate}%）</CardDescription>
        </CardHeader>

        <CardContent>
          <ChartContainer config={goalStatusConfig} className="h-[250px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
              <Pie data={goalStatusData} dataKey="count" nameKey="status" innerRadius={50} />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
