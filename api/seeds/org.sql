-- org ドメインの seed

INSERT INTO departments (id, name) VALUES
  (1, 'Corporate Planning'),
  (2, 'Human Resources'),
  (3, 'Engineering'),
  (4, 'Sales'),
  (5, 'Customer Success'),
  (6, 'Administration');

INSERT INTO org_departments (code, department_id, parent_code, manager_employee_code, sort_order) VALUES
  ('D001', 1, NULL, 'E001', 1),
  ('D002', 2, 'D001', 'E002', 1),
  ('D003', 3, 'D001', 'E004', 2),
  ('D004', 4, 'D001', 'E009', 3),
  ('D005', 5, 'D004', 'E013', 1),
  ('D006', 6, 'D001', 'E016', 4);

INSERT INTO org_memberships (department_code, employee_code, manager_employee_code) VALUES
  ('D001', 'E001', NULL),
  ('D002', 'E002', 'E001'),
  ('D002', 'E003', 'E002'),
  ('D003', 'E004', 'E001'),
  ('D003', 'E005', 'E004'),
  ('D004', 'E009', 'E001'),
  ('D004', 'E010', 'E009'),
  ('D005', 'E013', 'E009'),
  ('D006', 'E016', NULL);
