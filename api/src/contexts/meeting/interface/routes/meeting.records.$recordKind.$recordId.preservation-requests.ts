import { createMeetingPreservationSubmissionHandlers } from "@/contexts/meeting/interface/operations/create-meeting-preservation-submission-handlers"
import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createMeetingPreservationSubmissionHandlers("create"),
)
