SELECT
  COUNT(*) AS sample_size,
  COALESCE(SUM(p.education IN ('BENKE','SHUOSHI','BOSHI')), 0) AS above_bachelor,
  COALESCE(SUM(p.education IN ('DAZHUAN','GAOZHI')), 0) AS junior_college,
  COALESCE(SUM(p.education = 'BUXIAN'), 0) AS unrestricted,
  COALESCE(SUM(p.experience IN ('GRADUATING','ON_CAMPUS')), 0) AS student_or_graduate,
  COALESCE(SUM(p.experience = 'BUXIAN'), 0) AS experience_unrestricted,
  COALESCE(SUM(CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0), 0) AS salary_available,
  COALESCE(SUM(CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100), 0) AS salary_bucketed,

  COALESCE(SUM(p.education = 'BENKE'), 0) AS education_benke,
  COALESCE(SUM(p.education = 'SHUOSHI'), 0) AS education_shuoshi,
  COALESCE(SUM(p.education = 'BOSHI'), 0) AS education_boshi,
  COALESCE(SUM(p.education = 'DAZHUAN'), 0) AS education_dazhuan,
  COALESCE(SUM(p.education = 'GAOZHI'), 0) AS education_gaozhi,
  COALESCE(SUM(p.education = 'BUXIAN'), 0) AS education_buxian,
  COALESCE(SUM(p.education = 'ZHONGZHUAN/ZHONGJI'), 0) AS education_zhongzhuan_zhongji,
  COALESCE(SUM(p.education = 'GAOZHONG'), 0) AS education_gaozhong,
  COALESCE(SUM(p.education = 'CHUZHONGJIYIXIA'), 0) AS education_chuzhong_or_below,
  COALESCE(SUM(CASE WHEN p.education IS NOT NULL AND p.education NOT IN ('BENKE','SHUOSHI','BOSHI','DAZHUAN','GAOZHI','BUXIAN','ZHONGZHUAN/ZHONGJI','GAOZHONG','CHUZHONGJIYIXIA') THEN 1 ELSE 0 END), 0) AS education_other,

  COALESCE(SUM(p.experience = 'BUXIAN'), 0) AS experience_buxian,
  COALESCE(SUM(p.experience = 'GRADUATING'), 0) AS experience_graduating,
  COALESCE(SUM(p.experience = 'ON_CAMPUS'), 0) AS experience_on_campus,
  COALESCE(SUM(p.experience = 'LESS_THAN_1'), 0) AS experience_less_than_1,
  COALESCE(SUM(p.experience = 'LESS_THAN_3'), 0) AS experience_less_than_3,
  COALESCE(SUM(p.experience = 'LESS_THAN_5'), 0) AS experience_less_than_5,
  COALESCE(SUM(p.experience = 'LESS_THAN_10'), 0) AS experience_less_than_10,
  COALESCE(SUM(p.experience = 'MORE_THAN_10'), 0) AS experience_more_than_10,
  COALESCE(SUM(CASE WHEN p.experience IS NOT NULL AND p.experience NOT IN ('BUXIAN','GRADUATING','ON_CAMPUS','LESS_THAN_1','LESS_THAN_3','LESS_THAN_5','LESS_THAN_10','MORE_THAN_10') THEN 1 ELSE 0 END), 0) AS experience_other,

  COALESCE(SUM(p.data_source IS NULL), 0) AS source_null,
  COALESCE(SUM(p.data_source = 'BOSS直聘'), 0) AS source_boss,
  COALESCE(SUM(p.data_source = '前程无忧'), 0) AS source_51job,
  COALESCE(SUM(p.data_source = '智联招聘'), 0) AS source_zhaopin,
  COALESCE(SUM(CASE WHEN p.data_source IS NOT NULL AND p.data_source NOT IN ('BOSS直聘','前程无忧','智联招聘') THEN 1 ELSE 0 END), 0) AS source_other,

  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 < 3 THEN 1 ELSE 0 END), 0) AS salary_lt_3k,
  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 >= 3 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 < 6 THEN 1 ELSE 0 END), 0) AS salary_3_6k,
  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 >= 6 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 < 10 THEN 1 ELSE 0 END), 0) AS salary_6_10k,
  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 >= 10 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 < 15 THEN 1 ELSE 0 END), 0) AS salary_10_15k,
  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 >= 15 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 < 25 THEN 1 ELSE 0 END), 0) AS salary_15_25k,
  COALESCE(SUM(CASE WHEN CAST(p.min_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) > 0 AND CAST(p.max_salary AS DECIMAL(10,2)) <= 100 AND (CAST(p.min_salary AS DECIMAL(10,2)) + CAST(p.max_salary AS DECIMAL(10,2))) / 2 >= 25 THEN 1 ELSE 0 END), 0) AS salary_25k_plus
FROM c_company_position p
JOIN c_company_address a
  ON p.company_address_id = a.id
WHERE p.publish_state = 'PUBLISHING'
  AND p.deleted = 0
  AND a.city = {{CITY}}
  AND {{TITLE_PREDICATE}}
  {{INTERNSHIP_PREDICATE}}
