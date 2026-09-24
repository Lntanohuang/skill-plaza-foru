# -*- coding: utf-8 -*-
"""生成《岗位分析-高职切片.html》：读取 data/gz_*.tsv，相对路径引用同目录 echarts.min.js。纯 stdlib。"""
import csv
import json
from pathlib import Path

BASE = Path(__file__).parent
DATA = BASE / "data"
BLUE, GRAY, ACCENT = "#3b6fb6", "#9aa5b1", "#e8743b"
TXT = "#333"

EDU_MAP = [("BUXIAN", "不限"), ("ZHONGZHUAN/ZHONGJI", "中专/中技"), ("CHUZHONGJIYIXIA", "初中及以下"),
           ("GAOZHONG", "高中"), ("DAZHUAN", "大专"), ("GAOZHI", "高职"), ("BENKE", "本科"),
           ("SHUOSHI", "硕士"), ("BOSHI", "博士")]
EDU_CN = dict(EDU_MAP)
EXP_MAP = {"BUXIAN": "不限", "GRADUATING": "应届生", "ON_CAMPUS": "在校生", "LESS_THAN_1": "1年以内",
           "LESS_THAN_3": "3年以内", "LESS_THAN_5": "5年以内", "LESS_THAN_10": "10年以内",
           "MORE_THAN_10": "10年以上", "WEWER23": "其他(WEWER23)"}
EXP_ORDER = ["不限", "1年以内", "3年以内", "5年以内", "10年以内", "10年以上", "应届生", "在校生", "其他(WEWER23)"]
SAL_BUCKETS = ["<3K", "3-6K", "6-10K", "10-15K", "15-25K", "25K+"]
GRP_CN = {"core": "高职核心切片", "wide": "高职可投宽口径", "full": "全量在招"}


def read(name):
    with open(DATA / name, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def wan(v):
    return f"{v / 10000:.1f}万" if v >= 10000 else f"{v:,}"


def pct(v, total):
    return f"{v / total:.1%}"


def hbar_opt(cats_vals, title, note=None, accent_first=False):
    """横向条形图，数组首项（最大值）显示在最顶部并高亮"""
    data = list(reversed(cats_vals))
    return {
        "title": {"text": title, "left": 10, "top": 6,
                  "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"},
                    "formatter": "{b}<br/>{c}"},
        "grid": {"left": 12, "right": 92, "top": 36, "bottom": 8, "containLabel": True},
        "xAxis": {"type": "log", "logBase": 10, "min": 1,
                  "axisLabel": {"color": "#888", "fontSize": 10}},
        "yAxis": {"type": "category", "inverse": False, "data": [d[0] for d in data],
                  "axisLabel": {"color": TXT, "fontSize": 11}},
        "series": [{
            "type": "bar",
            "data": [{"value": d[1],
                      "label": {"show": True, "position": "right", "fontSize": 10, "color": TXT,
                                "formatter": d[2]},
                      "itemStyle": {"color": ACCENT if (accent_first and i == len(data) - 1) else BLUE}}
                     for i, d in enumerate(data)],
            "barMaxWidth": 17,
        }],
    }


def vbar_opt(cats_vals, title, highlight=None):
    total = sum(v for _, v, _ in cats_vals) or 1
    data = []
    for c, v, vs in cats_vals:
        data.append({"value": v,
                     "label": {"show": True, "position": "top", "fontSize": 9.5, "color": TXT,
                               "formatter": f"{vs}\n({v / total:.1%})"},
                     "itemStyle": {"color": ACCENT if highlight and c in highlight else BLUE}})
    return {
        "title": {"text": title, "left": 10, "top": 6,
                  "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "grid": {"left": 12, "right": 20, "top": 40, "bottom": 8, "containLabel": True},
        "xAxis": {"type": "category", "data": [c for c, _, _ in cats_vals],
                  "axisLabel": {"color": TXT, "fontSize": 10, "interval": 0, "rotate": 28}},
        "yAxis": {"type": "log", "logBase": 10, "min": 1,
                  "axisLabel": {"color": "#888", "fontSize": 10}},
        "series": [{"type": "bar", "data": data, "barMaxWidth": 34}],
    }


def grouped_opt(cats, s1, s2, title, series1, series2, y_name="组内占比 %", label1=None, label2=None):
    def mk(vals, color, raw):
        return {"type": "bar", "name": None, "data": [
            {"value": round(v, 1),
             "label": {"show": True, "position": "top", "fontSize": 8.5, "color": color,
                       "formatter": (f"{r:.0f}%" if r is not None else f"{v:.1f}")}}
            for v, r in zip(vals, raw)],
            "itemStyle": {"color": color}, "barMaxWidth": 24}
    a = mk(s1, GRAY, label1 or [None] * len(s1)); a["name"] = series1
    b = mk(s2, ACCENT, label2 or [None] * len(s2)); b["name"] = series2
    return {
        "title": {"text": title, "left": 10, "top": 6,
                  "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"top": 32, "right": 10, "textStyle": {"fontSize": 10, "color": TXT}},
        "grid": {"left": 12, "right": 20, "top": 62, "bottom": 8, "containLabel": True},
        "xAxis": {"type": "category", "data": cats,
                  "axisLabel": {"color": TXT, "fontSize": 10, "interval": 0, "rotate": 28}},
        "yAxis": {"type": "value", "name": y_name, "axisLabel": {"color": "#888", "fontSize": 10}},
        "series": [a, b],
    }


# ================= 数据 =================
# 学历（全量精确）
edu = {r["education"]: int(r["cnt"]) for r in read("gz_edu_full.tsv")}
total_all = sum(edu.values())
core_n = edu.get("DAZHUAN", 0) + edu.get("GAOZHI", 0)
wide_n = core_n + edu.get("ZHONGZHUAN/ZHONGJI", 0) + edu.get("GAOZHONG", 0) + edu.get("BUXIAN", 0)
benke_n = edu.get("BENKE", 0)

edu_sorted = sorted(((EDU_CN.get(k, k), v) for k, v in edu.items()), key=lambda x: -x[1])
c1 = [(k, v, wan(v)) for k, v in edu_sorted]

# 岗位名 TOP20（核心）
names = read("gz_topnames.tsv")[:20]
c2 = [(r["name"], int(r["cnt"]), f"{int(r['cnt']):,}") for r in names][::-1]

# 薪资分桶（核心 vs 全量，剔除面议/脏值后的组内占比）
bk = {(r["grp"], r["bucket"]): int(r["cnt"]) for r in read("gz_salary_bucket.tsv")}
core_b = {b: bk.get(("core", b), 0) for b in SAL_BUCKETS}
full_b = {b: bk.get(("full", b), 0) for b in SAL_BUCKETS}
core_valid = sum(core_b.values())
full_valid = sum(full_b.values())
c3 = grouped_opt(SAL_BUCKETS,
                 [full_b[b] / full_valid * 100 for b in SAL_BUCKETS],
                 [core_b[b] / core_valid * 100 for b in SAL_BUCKETS],
                 "5. 薪资分布对比：高职核心 vs 全量（有效薪资组内占比）",
                 "全量在招", "高职核心切片")
core_ge10 = (core_b["10-15K"] + core_b["15-25K"] + core_b["25K+"]) / core_valid
full_ge10 = (full_b["10-15K"] + full_b["15-25K"] + full_b["25K+"]) / full_valid
core_3_10 = (core_b["3-6K"] + core_b["6-10K"]) / core_valid

# 薪资统计
st = {r["grp"]: r for r in read("gz_salary_stats.tsv")}
med_core, med_full = float(st["core"]["median"]), float(st["full"]["median"])
p25_core, p75_core = float(st["core"]["p25"]), float(st["core"]["p75"])

# TOP20 岗位中位薪资（核心切片）
med = read("gz_topname_median.tsv")
c4 = [(r["name"], float(r["median"]), f"{float(r['median']):.1f}K") for r in med][::-1]
c4_opt = hbar_opt(c4, "7. TOP20 热门岗位中位薪资（K/月，高职核心切片）")
for item, r in zip(c4_opt["series"][0]["data"], reversed(med)):
    item["tooltip"] = {"show": True,
                       "formatter": f"{{b}}<br/>中位 {float(r['median']):.1f}K<br/>P25 {float(r['p25']):.1f}K · P75 {float(r['p75']):.1f}K<br/>样本 {int(r['cnt_valid']):,}"}
med_hi = sorted(((r["name"], float(r["median"])) for r in med), key=lambda x: -x[1])[:3]
med_lo = sorted(((r["name"], float(r["median"])) for r in med), key=lambda x: x[1])[:3]

# 经验（核心 vs 全量）
exp_g = {}
for r in read("gz_exp.tsv"):
    k = EXP_MAP.get(r["experience"], r["experience"])
    exp_g[(r["grp"], k)] = exp_g.get((r["grp"], k), 0) + int(r["cnt"])
core_e = {e: exp_g.get(("core", e), 0) for e in EXP_ORDER}
full_e = {e: exp_g.get(("full", e), 0) + exp_g.get(("core", e), 0) + exp_g.get(("wide_rest", e), 0)
          for e in EXP_ORDER}
core_et, full_et = sum(core_e.values()), sum(full_e.values())
c5 = grouped_opt(EXP_ORDER,
                 [full_e[e] / full_et * 100 for e in EXP_ORDER],
                 [core_e[e] / core_et * 100 for e in EXP_ORDER],
                 "6. 经验要求对比：高职核心 vs 全量（组内占比）",
                 "全量在招", "高职核心切片")
core_novice = (core_e["不限"] + core_e["1年以内"] + core_e["3年以内"] + core_e["应届生"]) / core_et
core_buxian = core_e["不限"] / core_et

# 省份 TOP15（核心）
prov = [r for r in read("gz_prov.tsv") if not r["province"].startswith("NULL")]
c6 = [(r["province"], int(r["cnt"]), f"{int(r['cnt']):,}") for r in prov[:15]][::-1]
gd_n = int(prov[0]["cnt"])
prov_cov = sum(int(r["cnt"]) for r in prov) / core_n

# 广东城市
city = [r for r in read("gz_gd_city.tsv") if not r["city"].startswith("NULL") and r["city"] != "香港特别行政区"]
c7 = [(r["city"], int(r["cnt"]), f"{int(r['cnt']):,}") for r in city][::-1]
gd_top3_share = sum(int(r["cnt"]) for r in city[:3]) / gd_n

# 产业链 TOP15
chain = read("gz_chain.tsv")[:15]
c8 = [(r["name"], int(r["cnt"]), f"{int(r['cnt']) / 10000:.1f}万") for r in chain][::-1]
cov = {r["metric"]: int(r["value"]) for r in read("gz_chain_cov.tsv")}
chain_avg = cov["link_cnt"] / cov["pos_cnt"]

# 数据来源（核心）
src = [(r["data_source"], int(r["cnt"])) for r in read("gz_src.tsv") if r["grp"] == "core"]
src_top = src[0]
src_top_share = src_top[1] / core_n

charts = {
    "c1": vbar_opt(c1, "1. 学历要求结构（全量在招，精确计数）", highlight={"大专", "高职"}),
    "c2": hbar_opt(c2, "2. 热门岗位 TOP20（高职核心切片，精确计数）"),
    "c3": c3,
    "c4": c4_opt,
    "c5": c5,
    "c6": hbar_opt(c6, "3. 省份 TOP15（高职核心切片，join 地址表精确计数）", accent_first=True),
    "c7": hbar_opt(c7, "4. 广东 21 市分布（高职核心切片）", accent_first=True),
    "c8": hbar_opt(c8, "8. 产业链 TOP15（高职核心岗位×产业链关联数）", accent_first=True),
}

# ================= 核心结论 =================
concl = [
    f"<b>盘子：</b>在招岗位（publish_state='PUBLISHING' 且未删除）共 <b>{wan(total_all)}</b> 条，其中明确要求大专/高职的"
    f"<b>高职核心切片 {wan(core_n)} 条（{pct(core_n, total_all)}）</b>；把学历门槛≤大专的岗位（再含中专/中技、高中、不限）合起来，"
    f"<b>高职可投宽口径 {wan(wide_n)} 条（{pct(wide_n, total_all)}）</b>——约四分之三的在招岗位不设本科门槛（要求本科及以上仅 {pct(benke_n + edu.get('SHUOSHI', 0) + edu.get('BOSHI', 0), total_all)}）。",
    f"<b>学历枚举现实：</b>'高职'（GAOZHI）作为独立枚举仅 {edu.get('GAOZHI', 0):,} 条（0.008%），高职层次岗位几乎全部落在'大专'（DAZHUAN，{wan(edu.get('DAZHUAN', 0))} 条）名下；"
    f"'不限学历'是最大单项（{wan(edu.get('BUXIAN', 0))} 条，{pct(edu.get('BUXIAN', 0), total_all)}），给高职生留出大量投递空间。",
    f"<b>薪资水平：</b>高职核心切片薪资中位 <b>{med_core:.1f}K/月</b>（全量 {med_full:.1f}K），P25–P75 为 {p25_core:.1f}K–{p75_core:.1f}K；"
    f"{core_3_10:.0%} 的岗位集中在 3–10K，10K 以上占 {core_ge10:.1%}（全量 {full_ge10:.1%}）——比全量低但差距有限（中位差 {med_full - med_core:.1f}K）。",
    f"<b>热门岗位：</b>TOP5 为 {'、'.join(r['name'] for r in names[:5])}；"
    f"中位薪资最高的是 {'、'.join(f'{n} {v:.1f}K' for n, v in med_hi)}，最低的是 {'、'.join(f'{n} {v:.1f}K' for n, v in med_lo)}——设计/运营/医护类量大，技术管理类（工艺工程师、项目经理、口腔科医生）薪资更高。",
    f"<b>经验门槛：</b>{core_buxian:.0%} 的核心岗位不限经验，{core_novice:.0%} 经验要求在 3 年以内或面向应届/在校生——对高职应届生友好，积累 3 年内即可覆盖绝大多数岗位。",
    f"<b>地域分布：</b>广东（{wan(gd_n)} 条）与河北（{wan(int(prov[1]['cnt']))} 条）双核引领，江苏、浙江紧随；广东省内深圳（{wan(int(city[0]['cnt']))}）、广州（{wan(int(city[1]['cnt']))}）、东莞（{wan(int(city[2]['cnt']))}）三市占省内 {gd_top3_share:.0%}。",
    f"<b>产业链标签：</b>核心岗位 {pct(cov['pos_cnt'], core_n)} 关联产业链（平均 {chain_avg:.2f} 条/岗），TOP 链为 {'、'.join(r['name'] for r in chain[:3])}——数字经济与现代服务业链条是高职岗位的主阵地。",
    f"<b>数据质量：</b>核心切片 {st['core']['share_valid']} 有数值薪资（面议/空值仅 0.1%）、{prov_cov:.1%} 可定位省份；来源以 {src_top[0]} 为主（{src_top_share:.0%}），薪酬口径为 (min+max)/2 的中值，单位 K/月。",
]

chips = [
    (wan(total_all), "在招岗位总量（精确）"),
    (f"{wan(core_n)} · {pct(core_n, total_all)}", "高职核心切片（大专+高职）"),
    (f"{wan(wide_n)} · {pct(wide_n, total_all)}", "高职可投宽口径（≤大专门槛）"),
    (f"{med_core:.1f}K", "核心切片薪资中位（全量 7.0K）"),
    (f"广东 {wan(gd_n)}", "核心切片 TOP1 省份"),
]

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>岗位库高职切片分析</title>
<style>
  body {{ margin: 0; background: #f4f6f9; font-family: "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; color: #333; }}
  .wrap {{ max-width: 1240px; margin: 0 auto; padding: 28px 20px 40px; }}
  h1 {{ font-size: 24px; margin: 0 0 6px; }}
  .sub {{ color: #777; font-size: 13px; margin-bottom: 18px; }}
  .chips {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }}
  .chip {{ background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 10px 16px; }}
  .chip b {{ display: block; font-size: 18px; color: {ACCENT}; }}
  .chip span {{ font-size: 12px; color: #888; }}
  .concl {{ background: #fff; border: 1px solid #e3e8ef; border-radius: 12px; padding: 16px 22px; margin-bottom: 26px; }}
  .concl h2 {{ font-size: 17px; margin: 0 0 10px; padding-left: 10px; border-left: 4px solid {ACCENT}; }}
  .concl ol {{ margin: 0; padding-left: 22px; }}
  .concl li {{ font-size: 13.5px; line-height: 1.85; margin-bottom: 6px; color: #444; }}
  h2 {{ font-size: 17px; margin: 30px 0 12px; padding-left: 10px; border-left: 4px solid {BLUE}; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
  .card {{ background: #fff; border: 1px solid #e3e8ef; border-radius: 12px; padding: 8px 6px 4px; }}
  .chart {{ width: 100%; height: 360px; }}
  .tall .chart {{ height: 480px; }}
  .note {{ font-size: 12px; color: #999; margin-top: 16px; line-height: 1.8; }}
  @media (max-width: 900px) {{ .grid {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<div class="wrap">
  <h1>岗位库高职切片分析——大专（高职）可投岗位画像</h1>
  <div class="sub">数据源：MySQL ai_crowd_souring_extend.c_company_position · 快照日期 2026-09-20 · 除注明外均为全量精确计数 · 悬停查看数值</div>

  <div class="chips">
    {''.join(f'<div class="chip"><b>{v}</b><span>{k}</span></div>' for v, k in chips)}
  </div>

  <div class="concl">
    <h2>核心结论</h2>
    <ol>{''.join(f'<li>{c}</li>' for c in concl)}</ol>
  </div>

  <h2>切片结构与画像</h2>
  <div class="grid">
    <div class="card"><div id="c1" class="chart"></div></div>
    <div class="card tall"><div id="c2" class="chart"></div></div>
  </div>

  <h2>地域分布（高职核心切片）</h2>
  <div class="grid">
    <div class="card tall"><div id="c6" class="chart"></div></div>
    <div class="card tall"><div id="c7" class="chart"></div></div>
  </div>

  <h2>薪资与经验</h2>
  <div class="grid">
    <div class="card"><div id="c3" class="chart"></div></div>
    <div class="card"><div id="c5" class="chart"></div></div>
    <div class="card tall"><div id="c4" class="chart"></div></div>
    <div class="card tall"><div id="c8" class="chart"></div></div>
  </div>

  <div class="note">
    口径：在招岗位 = publish_state='PUBLISHING' 且 deleted=0，共 {total_all:,} 条（精确）。<b>高职核心切片</b> = education IN ('DAZHUAN','GAOZHI')，{core_n:,} 条；
    <b>高职可投宽口径</b> = 核心切片 + 中专/中技 + 高中 + 不限，{wide_n:,} 条。<br>
    薪资 = (min_salary+max_salary)/2 中值（K/月，varchar 转数值），剔除中值=0（面议/无值，核心切片占 0.1%）与 >100K 脏值（0.03%）后统计；
    分位数为加权线性插值。省份/城市经 company_address_id join c_company_address（覆盖率 {prov_cov:.2%}）。
    产业链计数为"岗位×链"关联数（一岗多链，核心岗位平均 {chain_avg:.2f} 链），非去重岗位数。<br>
    数据局限：create_time 为爬虫批次时间而非岗位真实发布时间；岗位无可回溯职位链接；来源以 BOSS直聘（{src_top_share:.0%}）为主，高校就业网来源占比小且无薪资字段；省份字段存在少量脏值（如"石家庄市"19 条）。
  </div>
</div>
<script src="echarts.min.js"></script>
<script>
const CHARTS = {json.dumps(charts, ensure_ascii=False)};
const insts = [];
window.addEventListener('load', () => {{
  for (const [id, opt] of Object.entries(CHARTS)) {{
    const el = document.getElementById(id);
    if (!el) continue;
    const c = echarts.init(el);
    c.setOption(opt);
    insts.push(c);
  }}
  window.addEventListener('resize', () => insts.forEach(c => c.resize()));
}});
</script>
</body>
</html>
"""

out = BASE / "岗位分析-高职切片.html"
out.write_text(html, encoding="utf-8")
print(out, out.stat().st_size // 1024, "KB,", len(charts), "charts")
print("conclusions:", len(concl))
