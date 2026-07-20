import type { InferResponseType } from "hono/client"
import type { ApiClient } from "api/app"

/** 目標ツリーの型。api/app の AppType から InferResponseType で自動導出する */
export type GoalTreeResponse = InferResponseType<ApiClient["goals"]["tree"]["$get"], 200>

export type GoalTreeNode = GoalTreeResponse["roots"][number]
