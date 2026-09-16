import { recruitmentFactory } from "@/contexts/recruitment/interface/request-environment/recruitment-factory"
import { createRecruitmentSourceFreezeReadHandlers } from "@/contexts/recruitment/interface/operations/create-recruitment-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = recruitmentFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createRecruitmentSourceFreezeReadHandlers(),
)
