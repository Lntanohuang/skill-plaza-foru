SELECT
  CASE
    WHEN mid < 3 THEN '<3K'
    WHEN mid < 6 THEN '3-6K'
    WHEN mid < 10 THEN '6-10K'
    WHEN mid < 15 THEN '10-15K'
    WHEN mid < 25 THEN '15-25K'
    ELSE '25K+'
  END AS salary_bucket,
  COUNT(*) AS count
FROM (
  SELECT (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 AS mid
  FROM c_company_position p
  JOIN c_company_address a ON p.company_address_id = a.id
  WHERE p.publish_state = 'PUBLISHING'
    AND p.deleted = 0
    AND a.city = {{CITY}}
    AND {{TITLE_PREDICATE}}
    {{INTERNSHIP_PREDICATE}}
    AND CAST(p.min_salary AS DECIMAL(10,2)) > 0
    AND CAST(p.max_salary AS DECIMAL(10,2)) > 0
    AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100
) salary_values
GROUP BY salary_bucket
ORDER BY FIELD(salary_bucket, '<3K', '3-6K', '6-10K', '10-15K', '15-25K', '25K+')
