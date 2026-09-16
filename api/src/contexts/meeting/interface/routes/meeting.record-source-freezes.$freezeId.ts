import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { createMeetingSourceFreezeReadHandlers } from "@/contexts/meeting/interface/operations/create-meeting-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createMeetingSourceFreezeReadHandlers(),
)
