SELECT
  p.experience,
  COUNT(*) AS count
FROM c_company_position p
JOIN c_company_address a ON p.company_address_id = a.id
WHERE p.publish_state = 'PUBLISHING'
  AND p.deleted = 0
  AND a.city = {{CITY}}
  AND {{TITLE_PREDICATE}}
  {{INTERNSHIP_PREDICATE}}
GROUP BY p.experience
ORDER BY count DESC
LIMIT 20
