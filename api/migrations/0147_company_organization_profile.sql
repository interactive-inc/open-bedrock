ALTER TABLE company_organizations
  ADD COLUMN name TEXT NOT NULL DEFAULT ''
  CHECK (length(name) <= 200 AND trim(name) = name AND instr(name, char(0)) = 0);

ALTER TABLE company_organizations
  ADD COLUMN representative_name TEXT NOT NULL DEFAULT ''
  CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  );
