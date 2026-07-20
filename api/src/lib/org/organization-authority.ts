/**
 * 組織図上で actor が target に対して持つ管理関係。
 * IAM permission は「操作能力」、本型は「対象範囲」だけを表す。
 */
export type OrganizationAuthority = {
  directManager: boolean
  departmentManager: boolean
  managementChain: boolean
}
