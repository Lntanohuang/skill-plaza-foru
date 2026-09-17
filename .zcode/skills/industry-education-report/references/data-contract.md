# 数据、引用与文件契约

Python 3 标准库即可执行。report.json 的顶层字段：

- title、audience（college/government）、region、chain、period、as_of（YYYY-MM-DD）、status（sample/draft/final）。
- sources：id、title、publisher、url（原始 https URL）、published、accessed、locator（页/表/节）、scope、excerpt（短摘录或明确标注的释义）。网页无发布日期写“未标注”，不能推定。
- metrics：id、label、value（有限数字）、unit、period、region、population、definition、source_ids。每一指标保留统计对象与口径，不能只有单位。可选 derived（inputs 数组及 operation=sum/ratio/percent），派生值自动复核；派生指标及输入另填 price_basis（价格口径/不适用）和 comparable_group（经审核的可比组），输出须与输入地域/时期/统计对象一致，比例输出单位为 % 或 比值；禁止不同价格基准混算和循环依赖。
- claims：id、kind（fact/inference/recommendation）、text、source_ids、metric_ids、limitation。至少一个支持来源或指标；ID 关联不能替代语义审查。建议中的时间、人数、预算若为拟议目标，明确标注“建议目标”，不得写成调查结果。
- sections：id、claim_ids、gap_ids；必须与 assets/templates.json 该版章节顺序完全一致。
- gaps：id、description、owner、required_data、impact。不存在缺口时使用空数组。
- charts：id、title、metric_ids、note、type（table）。表格为默认可视化，自动附时期、地域、单位、定义及引用。若另外绘图，必须保留这些说明，禁止混单位同轴和缺数画零。

每章至少包含一条关键结论或缺数记录。全部 claims/gaps 必须出现在章节中；全部指标必须由结论或图表使用。sources/metrics/claims/gaps/charts 内的 ID 唯一且非空。

## 六主题的取数责任和边界

| 主题 | 首选数据 | 核心边界 |
|---|---|---|
| 区域产业 | 统计公报、经济普查、主管部门统计 | 行业增加值/产品产量/营收不同；现价与可比价不同 |
| 岗位人才 | 人社公共招聘、企业岗位台账、抽样调查 | 去重企业+岗位+地区+日期；说明样本覆盖，不外推总体缺口 |
| 重点企业 | 年报、企业官网、政府项目清单 | 集团/法人/工厂不同，候选不等于合作承诺 |
| 就业去向 | 学校学籍、毕业去向落实台账及质量年报 | 毕业届别、截止日期、分母、协议就业/升学/灵活就业分类；小样本脱敏 |
| 专业课程 | 教育部专业教学标准、校内人才培养方案 | 专业代码、层次、版本；课程建议需映射岗位能力 |
| 招商 | 规划、项目可研、园区资源台账 | 目标/意向/签约/开工/投产分开；不得凭产业增速确定补贴或投资 |

语义审查附加检查：来源仍可访问；原文能支持数据；指标范围与正文一致；推断包含限制；用户模板额外条款已覆盖。原文全文和敏感微观台账不应默认发布到 GitHub，仅发布必要短摘录、聚合数据和公开链接。
