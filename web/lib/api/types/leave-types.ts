import type { InferRequestType, InferResponseType } from "hono/client"
import type { ApiClient } from "api/app"

/** POST /leave-requests のレスポンス（作成された leave request エンティティ）。 */
export type LeaveRequestCreated = InferResponseType<ApiClient["leave-requests"]["$post"], 201>

/** 共通サブ型。レスポンス型から導出する。 */
export type LeaveType = LeaveRequestCreated["leave_type"]

export type LeaveStatus = LeaveRequestCreated["status"]

/** GET /leave-balances/me のレスポンス要素。 */
export type LeaveBalanceResponse = InferResponseType<
  ApiClient["leave-balances"]["me"]["$get"],
  200
>[number]

/** GET /leave-requests/me のレスポンス要素。 */
export type LeaveRequestMineResponse = InferResponseType<
  ApiClient["leave-requests"]["me"]["$get"],
  200
>["data"][number]

/** GET /leave-requests/inbox のレスポンス要素（承認者向け、申請者名付き）。 */
export type LeaveRequestInboxResponse = InferResponseType<
  ApiClient["leave-requests"]["inbox"]["$get"],
  200
>["data"][number]

/** POST /leave-requests のリクエストボディ。 */
export type LeaveRequestCreateRequest = InferRequestType<
  ApiClient["leave-requests"]["$post"]
>["json"]

/** POST /leave-requests/:id/approve | reject のレスポンス。 */
export type LeaveDecisionResponse = InferResponseType<
  ApiClient["leave-requests"][":id"]["approve"]["$post"],
  200
>

/** PUT /leave-requests/:id のリクエストボディ。 */
export type LeaveRequestUpdateRequest = InferRequestType<
  ApiClient["leave-requests"][":id"]["$put"]
>["json"]

/** GET /leave-requests/:id と PUT /leave-requests/:id のレスポンス。 */
export type LeaveRequestDetailResponse = InferResponseType<
  ApiClient["leave-requests"][":id"]["$get"],
  200
>
