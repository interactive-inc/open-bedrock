-- Keep the shared Company schema aligned with the shared system context's account-link history index.
CREATE INDEX company_resource_revisions_account_link_idx
  ON company_resource_revisions (organization_id, resource_id)
  WHERE resource_type = 'account-employee-link';
