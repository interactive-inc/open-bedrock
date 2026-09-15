import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { createSoftwareLicenseSourceFreezeReadHandlers } from "@/contexts/software-license/interface/operations/create-software-license-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = softwareLicenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSoftwareLicenseSourceFreezeReadHandlers(),
)
