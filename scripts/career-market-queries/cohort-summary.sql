SELECT
  COUNT(*) AS sample_size,
  SUM(p.education IN ('BENKE','SHUOSHI','BOSHI')) AS above_bachelor,
  SUM(p.education IN ('DAZHUAN','GAOZHI')) AS junior_college,
  SUM(p.education = 'BUXIAN') AS unrestricted,
  SUM(p.experience IN ('GRADUATING','ON_CAMPUS')) AS student_or_graduate,
  SUM(p.experience = 'BUXIAN') AS experience_unrestricted,
  SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 THEN 1 ELSE 0 END) AS salary_available
FROM c_company_position p
JOIN c_company_address a ON p.company_address_id = a.id
WHERE p.publish_state = 'PUBLISHING'
  AND p.deleted = 0
  AND a.city = {{CITY}}
  AND {{TITLE_PREDICATE}}
  {{INTERNSHIP_PREDICATE}}
