/**
 * Company の汎用 resource route が必須で要求する organization の識別子。
 * api の companyActor middleware が organizationIds を ["organization:default"] に
 * 固定しているため、これ以外を送ると必ず 403 になる。
 */
export const companyOrganizationId = "organization:default"
