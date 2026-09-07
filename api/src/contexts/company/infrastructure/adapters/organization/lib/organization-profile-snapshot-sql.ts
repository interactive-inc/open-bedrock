/** 会社版、公開profileの有効な訂正、移行前の会社情報を一つのsnapshotに固定する。 */
export function organizationProfileSnapshotSql(): string {
  return `SELECT json_object(
    'organizationId', organization.id, 'organizationRevision', organization.revision,
    'legacyName', organization.name, 'legacyRepresentativeName', organization.representative_name,
    'legacyUpdatedAt', organization.updated_at,
    'profileCount', (SELECT count(*) FROM company_resource_heads WHERE organization_id = organization.id AND resource_type = 'company-profile'),
    'resourceId', head.resource_id, 'resourceRevision', head.revision,
    'state', effective.state, 'effectiveTo', effective.effective_to, 'attributesJson', effective.attributes_json
  ) AS source_json
  FROM company_organizations organization
  LEFT JOIN company_resource_heads head ON head.organization_id = organization.id AND head.resource_type = 'company-profile'
  LEFT JOIN company_resource_revisions effective ON effective.organization_id = organization.id
    AND effective.resource_type = 'company-profile' AND effective.resource_id = head.resource_id
    AND effective.revision = (SELECT resource.revision FROM company_resource_revisions resource
      WHERE resource.organization_id = organization.id AND resource.resource_type = 'company-profile'
        AND resource.resource_id = head.resource_id AND resource.organization_revision <= organization.revision
        AND resource.effective_from <= ?2 ORDER BY resource.effective_from DESC, resource.revision DESC LIMIT 1)
  WHERE organization.id = ?1`
}
