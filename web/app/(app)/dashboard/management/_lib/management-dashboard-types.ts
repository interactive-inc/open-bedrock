// 経営ダッシュボードの型。api/app の AppType から InferResponseType で自動導出し、
// API 側のフィールド変更をコンパイルエラーとして検知する。
import type { InferResponseType } from "hono/client"
import type { ApiClient } from "api/app"

export type ManagementDashboard = InferResponseType<
  ApiClient["dashboard"]["management"]["$get"],
  200
>

export type DepartmentHeadcount = ManagementDashboard["department_headcounts"][number]

export type GoalDoneRate = ManagementDashboard["goal_done_rates"][number]
