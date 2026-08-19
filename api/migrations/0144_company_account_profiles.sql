CREATE TABLE company_account_profiles (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (organization_id, account_id)
);

CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);

INSERT INTO company_account_profiles (
  organization_id,
  account_id,
  display_name,
  created_at,
  updated_at
)
SELECT
  'organization:default',
  account.id,
  substr(
    COALESCE(
      NULLIF(trim(employee.name), ''),
      NULLIF(
        trim(
          (
            SELECT min(profile.email)
            FROM system_identity_bindings binding
            INNER JOIN system_identity_profiles profile ON profile.identity_id = binding.id
            WHERE binding.account_id = account.id
              AND binding.activated_at IS NOT NULL
              AND binding.revoked_at IS NULL
              AND profile.email IS NOT NULL
          )
        ),
        ''
      ),
      account.id
    ),
    1,
    200
  ),
  account.created_at,
  max(account.created_at, account.updated_at)
FROM system_accounts account
LEFT JOIN account_employee_links link ON link.account_id = account.id
LEFT JOIN employees employee ON employee.id = link.employee_id
WHERE account.id <> 'system:migration';

SELECT CASE
  WHEN (
    SELECT count(*) FROM system_accounts WHERE id <> 'system:migration'
  ) = (
    SELECT count(*) FROM company_account_profiles
  )
  THEN 1
  ELSE json_extract('', '$')
END AS company_account_profile_count_matches;

SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1
    FROM company_account_profiles
    WHERE length(display_name) NOT BETWEEN 1 AND 200
       OR trim(display_name) <> display_name
       OR instr(display_name, char(0)) <> 0
  )
  THEN 1
  ELSE json_extract('', '$')
END AS company_account_profile_values_are_valid;
