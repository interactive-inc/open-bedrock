import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { createMeetingSourceFreezeHandlers } from "@/contexts/meeting/interface/operations/create-meeting-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createMeetingSourceFreezeHandlers("release"),
)
