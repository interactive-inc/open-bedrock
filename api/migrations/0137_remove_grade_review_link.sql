-- Company の等級割当を Performance Review から独立させる。
ALTER TABLE employee_grades DROP COLUMN review_cycle_id;
