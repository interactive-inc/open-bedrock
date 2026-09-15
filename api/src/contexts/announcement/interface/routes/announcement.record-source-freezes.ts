import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { createAnnouncementSourceFreezeHandlers } from "@/contexts/announcement/interface/operations/create-announcement-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を保存時にも検査する
export const POST = announcementFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAnnouncementSourceFreezeHandlers("create"),
)
