import { skillFactory } from "@/contexts/skill/interface/request-environment/skill-factory"
import { createSkillSourceFreezeReadHandlers } from "@/contexts/skill/interface/operations/create-skill-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = skillFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSkillSourceFreezeReadHandlers(),
)
