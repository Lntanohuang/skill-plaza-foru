# -*- coding: utf-8 -*-
"""生成岗位分析 HTML：读取 data/*.tsv，产出内嵌 echarts + 数据的单文件页面。"""
import json
from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent
DATA = BASE / "data"
BLUE, GRAY, ACCENT = "#3b6fb6", "#9aa5b1", "#e8743b"
TXT = "#333"

NOTE_SAMPLE = "口径：在招岗位（PUBLISHING 且未删除）；学历/经验/薪资/岗位名/城市为主键 1/500 抽样（n≈20,005）"
NOTE_EXACT = "口径：全表精确计数（11,571,009 行，按主键分段/索引范围统计）"

edu_map = {"BUXIAN": "不限", "ZHONGZHUAN/ZHONGJI": "中专/中技", "CHUZHONGJIYIXIA": "初中及以下",
           "GAOZHONG": "高中", "DAZHUAN": "大专", "GAOZHI": "高职", "BENKE": "本科",
           "SHUOSHI": "硕士", "BOSHI": "博士"}
exp_order = ["不限", "1年以内", "3年以内", "5年以内", "10年以内", "10年以上", "应届生", "在校生"]
exp_map = {"BUXIAN": "不限", "GRADUATING": "应届生", "ON_CAMPUS": "在校生", "LESS_THAN_1": "1年以内",
           "LESS_THAN_3": "3年以内", "LESS_THAN_5": "5年以内", "LESS_THAN_10": "10年以内",
           "MORE_THAN_10": "10年以上"}
sal_order = ["<3K", "3-6K", "6-10K", "10-15K", "15-25K", "25-50K", "50K+"]


def read(name):
    return pd.read_csv(DATA / name, sep="\t")


def wan(v):
    return f"{v / 10000:.0f}万" if v >= 10000 else f"{int(v)}"


def base_grid():
    return {"left": 12, "right": 28, "top": 40, "bottom": 8, "containLabel": True}


def hbar_opt(cats_vals, title, note=None, accent_first=False, height=None):
    """横向条形图，cats_vals: [(label, value, value_str)]，数组首项（最大值）显示在最顶部并高亮"""
    data = list(reversed(cats_vals))
    return {
        "title": {"text": title, "left": 10, "top": 6, "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "grid": {"left": 12, "right": 92, "top": 40, "bottom": 8, "containLabel": True},
        "xAxis": {"type": "log", "logBase": 10, "min": 1, "axisLabel": {"color": "#888", "fontSize": 10}},
        "yAxis": {"type": "category", "inverse": True, "data": [d[0] for d in data],
                  "axisLabel": {"color": TXT, "fontSize": 11}},
        "series": [{
            "type": "bar",
            "data": [{"value": d[1],
                      "label": {"show": True, "position": "right", "fontSize": 10, "color": TXT,
                                "formatter": d[2]},
                      "itemStyle": {"color": ACCENT if (accent_first and i == 0) else BLUE}}
                     for i, d in enumerate(data)],
            "barMaxWidth": 18,
        }],
    }


def vbar_opt(cats_vals, title, ylog=False, y_name=None, label_pct=True):
    total = sum(v for _, v, _ in cats_vals) or 1
    data = []
    for i, (c, v, vs) in enumerate(cats_vals):
        lab = f"{vs}\n({v / total:.1%})" if label_pct else vs
        data.append({"value": v, "label": {"show": True, "position": "top", "fontSize": 9.5, "color": TXT,
                                           "formatter": lab}})
    yaxis = {"type": "log", "logBase": 10} if ylog else {"type": "value"}
    if not ylog:
        yaxis["max"] = round(max(v for _, v, _ in cats_vals) * 1.25) if cats_vals else 1
    yaxis["axisLabel"] = {"color": "#888", "fontSize": 10}
    if y_name:
        yaxis["name"] = y_name
    return {
        "title": {"text": title, "left": 10, "top": 6, "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "grid": base_grid(),
        "xAxis": {"type": "category", "data": [c for c, _, _ in cats_vals],
                  "axisLabel": {"color": TXT, "fontSize": 10, "interval": 0, "rotate": 28}},
        "yAxis": yaxis,
        "series": [{"type": "bar", "data": data, "barMaxWidth": 34,
                    "itemStyle": {"color": BLUE}}],
    }


def grouped_opt(cats, s1, s2, title, y_name="占比 %", series1="全部在招岗位", series2="AI 命名岗位"):
    mk = lambda vals, color: {"type": "bar", "name": None, "data": [
        {"value": round(v, 1), "label": {"show": True, "position": "top", "fontSize": 9, "color": color,
                                         "formatter": f"{v:.0f}%"}} for v in vals],
        "itemStyle": {"color": color}, "barMaxWidth": 26}
    a = mk(s1, GRAY); a["name"] = series1
    b = mk(s2, ACCENT); b["name"] = series2
    return {
        "title": {"text": title, "left": 10, "top": 6, "textStyle": {"fontSize": 14, "fontWeight": "bold", "color": TXT}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"top": 34, "right": 10, "textStyle": {"fontSize": 10, "color": TXT}},
        "grid": {"left": 12, "right": 20, "top": 64, "bottom": 8, "containLabel": True},
        "xAxis": {"type": "category", "data": cats, "axisLabel": {"color": TXT, "fontSize": 10, "interval": 0, "rotate": 28}},
        "yAxis": {"type": "value", "name": y_name, "axisLabel": {"color": "#888", "fontSize": 10}},
        "series": [a, b],
    }


# ---------- 数据 ----------
src = read("src.tsv").groupby("data_source", as_index=False)["cnt"].sum().sort_values("cnt", ascending=False)
top = src.head(8)
rest = int(src.iloc[8:]["cnt"].sum())
src_total = int(src["cnt"].sum())
c1 = [(r.data_source if pd.notna(r.data_source) else "(空)", int(r.cnt),
       f"{int(r.cnt) / 10000:.0f}万 ({int(r.cnt) / src_total:.1%})") for r in top.itertuples()]
if rest:
    c1.append(("其他(高校就业网等)", rest, f"{rest / 10000:.1f}万 ({rest / src_total:.1%})"))
c1 = c1[::-1]

monthly = read("monthly.tsv")
c2 = [(m, int(v), wan(v)) for m, v in zip(monthly["m"], monthly["cnt"])]

edu = read("edu.tsv").query("education != 'NULL'").assign(k=lambda d: d.education.map(edu_map)).dropna(subset=["k"])
edu = edu.groupby("k")["cnt"].sum().sort_values(ascending=False)
c3 = [(k, int(v), f"{int(v):,}") for k, v in edu.items()]

exp = read("exp.tsv").query("experience in @exp_map.keys()").assign(k=lambda d: d.experience.map(exp_map))
exp = exp.groupby("k")["cnt"].sum().reindex(exp_order).dropna()
c4 = [(k, int(v), f"{int(v):,}") for k, v in exp.items()]

sal = read("salary.tsv").query("bucket in @sal_order").groupby("bucket")["cnt"].sum().reindex(sal_order)
c5 = [(k, int(v), f"{int(v):,}") for k, v in sal.items()]

names = read("topnames.tsv")
c6 = [(n, int(v), f"{int(v):,}") for n, v in zip(names["name"], names["cnt"])][::-1]

prov_all = read("prov.tsv").query("province != 'NULL'")
prov = prov_all.head(12)
gd_share = prov_all.loc[prov_all.province == "广东省", "cnt"].iloc[0] / prov_all["cnt"].sum()
c7 = [(p, int(v), f"{int(v):,}") for p, v in zip(prov["province"], prov["cnt"])][::-1]

city = read("gd_city.tsv")
c8 = [(ct, int(v), f"{int(v):,}") for ct, v in zip(city["city"], city["cnt"])][::-1]

ai_sal = read("ai_salary.tsv").query("bucket in @sal_order")
piv = ai_sal.pivot_table(index="bucket", columns="grp", values="cnt", aggfunc="sum").reindex(sal_order).fillna(0)
c9 = grouped_opt(list(piv.index), list(piv["ALL"] / piv["ALL"].sum() * 100),
                 list(piv["AI"] / piv["AI"].sum() * 100), "9. 薪资结构：AI 岗 vs 全部（组内占比）")

ai_edu = read("ai_edu.tsv").query("education in @edu_map.keys()")
edu_p = (ai_edu.assign(k=lambda d: d.education.map(edu_map))
         .pivot_table(index="k", columns="grp", values="cnt", aggfunc="sum").fillna(0))
edu_p = edu_p.reindex(edu_p["ALL"].sort_values(ascending=False).index)
c10 = grouped_opt(list(edu_p.index), list(edu_p["ALL"] / edu_p["ALL"].sum() * 100),
                  list(edu_p["AI"] / edu_p["AI"].sum() * 100), "10. 学历结构：AI 岗 vs 全部（组内占比）")

ai_prov = read("ai_prov.tsv")
c11 = [(p, int(v), f"{int(v):,}") for p, v in zip(ai_prov["province"], ai_prov["cnt"])][::-1]

charts = {
    "c1": hbar_opt(c1, "1. 数据来源构成（全量 1,157 万行）", accent_first=True),
    "c2": vbar_opt(c2, "2. 数据更新批次（按月，对数轴）", ylog=True, y_name="变更行数", label_pct=False),
    "c3": vbar_opt(c3, "3. 学历要求分布（在招）"),
    "c4": vbar_opt(c4, "4. 经验要求分布（在招）"),
    "c5": vbar_opt(c5, "5. 薪资下限分桶（在招，单位 K/月）", label_pct=False),
    "c6": hbar_opt(c6, "6. 岗位名 Top15（在招）"),
    "c7": hbar_opt(c7, f"7. 在招岗位省份 Top12（广东占 {gd_share:.1%}，≈147 万条）", accent_first=True),
    "c8": hbar_opt(c8, "8. 广东 21 市在招岗位分布（抽样）"),
    "c9": c9, "c10": c10,
    "c11": hbar_opt(c11, "11. AI 命名岗位省份 Top10（抽样）", accent_first=True),
}

# 月度图给主力批次上橙色
c2_data = charts["c2"]["series"][0]["data"]
for i, (m, _, _) in enumerate(c2):
    if m in ("2026-06", "2026-07"):
        c2_data[i]["itemStyle"] = {"color": ACCENT}

echarts_js = (BASE / "echarts.min.js").read_text()

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>c_company_position 主表分析</title>
<style>
  body {{ margin: 0; background: #f4f6f9; font-family: "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; color: #333; }}
  .wrap {{ max-width: 1240px; margin: 0 auto; padding: 28px 20px 40px; }}
  h1 {{ font-size: 24px; margin: 0 0 6px; }}
  .sub {{ color: #777; font-size: 13px; margin-bottom: 18px; }}
  .chips {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 26px; }}
  .chip {{ background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 10px 16px; }}
  .chip b {{ display: block; font-size: 18px; color: {ACCENT}; }}
  .chip span {{ font-size: 12px; color: #888; }}
  h2 {{ font-size: 17px; margin: 30px 0 12px; padding-left: 10px; border-left: 4px solid {BLUE}; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
  .grid.single {{ grid-template-columns: 1fr 1fr 1fr; }}
  .card {{ background: #fff; border: 1px solid #e3e8ef; border-radius: 12px; padding: 8px 6px 4px; }}
  .chart {{ width: 100%; height: 360px; }}
  .tall .chart {{ height: 470px; }}
  .note {{ font-size: 12px; color: #999; margin-top: 16px; line-height: 1.7; }}
  @media (max-width: 900px) {{ .grid, .grid.single {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<div class="wrap">
  <h1>c_company_position 主表分析</h1>
  <div class="sub">数据源：MySQL ai_crowd_souring_extend · 抽取时间 2026-09-20 · 悬停可查看数值</div>

  <div class="chips">
    <div class="chip"><b>1,157 万</b><span>总行数（精确）</span></div>
    <div class="chip"><b>962 万</b><span>在招岗位（PUBLISHING）</span></div>
    <div class="chip"><b>{gd_share:.1%}</b><span>广东在招占比 ≈147 万条</span></div>
    <div class="chip"><b>0.69%</b><span>AI 命名岗位占比</span></div>
    <div class="chip"><b>2026-07</b><span>数据快照口径</span></div>
  </div>

  <h2>全国概览</h2>
  <div class="grid">
    <div class="card"><div id="c1" class="chart"></div></div>
    <div class="card"><div id="c2" class="chart"></div></div>
    <div class="card"><div id="c3" class="chart"></div></div>
    <div class="card"><div id="c4" class="chart"></div></div>
  </div>

  <h2>岗位画像与地域</h2>
  <div class="grid">
    <div class="card"><div id="c5" class="chart"></div></div>
    <div class="card tall"><div id="c6" class="chart"></div></div>
    <div class="card tall"><div id="c7" class="chart"></div></div>
    <div class="card tall"><div id="c8" class="chart"></div></div>
  </div>

  <h2>AI 岗位切片</h2>
  <div class="grid single">
    <div class="card"><div id="c9" class="chart"></div></div>
    <div class="card"><div id="c10" class="chart"></div></div>
    <div class="card"><div id="c11" class="chart"></div></div>
  </div>

  <div class="note">
    图 1、2 {NOTE_EXACT}；图 3–8 {NOTE_SAMPLE}；图 9–11 为主键 1/100 抽样（n≈101,467，其中 AI 命名岗位 717 条），AI = 岗位名含 算法/机器学习/深度学习/大模型/AIGC/NLP/自然语言/CV/语音识别/人工智能/自动驾驶 等词。<br>
    城市经 company_address_id 关联地址表（解析率 99.98%）；薪资单位 K/月，取岗位薪资下限分桶。
  </div>
</div>
<script>{echarts_js}</script>
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

out = BASE / "岗位分析.html"
out.write_text(html)
print(out, out.stat().st_size // 1024, "KB,", len(charts), "charts")
