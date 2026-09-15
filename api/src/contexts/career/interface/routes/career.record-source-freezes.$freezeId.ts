import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { createCareerSourceFreezeReadHandlers } from "@/contexts/career/interface/operations/create-career-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = careerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCareerSourceFreezeReadHandlers(),
)
