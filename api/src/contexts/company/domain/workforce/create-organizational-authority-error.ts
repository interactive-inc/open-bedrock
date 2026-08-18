import { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"

export function createOrganizationalAuthorityError(
  code: ConstructorParameters<typeof OrganizationalAuthorityError>[0],
): OrganizationalAuthorityError {
  return new OrganizationalAuthorityError(code)
}
