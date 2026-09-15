import { createAnnouncementRetirementDecisionHandlers } from "@/contexts/announcement/interface/operations/create-announcement-retirement-decision-handlers"
import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = announcementFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAnnouncementRetirementDecisionHandlers("reject"),
)
