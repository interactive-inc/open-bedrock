import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { createAnnouncementSourceFreezeReadHandlers } from "@/contexts/announcement/interface/operations/create-announcement-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = announcementFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAnnouncementSourceFreezeReadHandlers(),
)
