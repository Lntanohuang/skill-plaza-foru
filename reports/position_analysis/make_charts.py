# -*- coding: utf-8 -*-
"""c_company_position 主表分析图表：从 data/*.tsv 读取聚合结果，输出 3 张 PNG。"""
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib import font_manager

BASE = Path(__file__).parent
DATA = BASE / "data"
OUT = BASE

# ---- 中文字体：优先 macOS 系统字体 ----
candidates = ["PingFang SC", "Hiragino Sans GB", "Arial Unicode MS", "Heiti SC", "STHeiti"]
available = {f.name for f in font_manager.fontManager.ttflist}
picked = next((c for c in candidates if c in available), None)
if picked is None:
    # 兜底：按文件路径注册 Arial Unicode
    for p in ["/Library/Fonts/Arial Unicode.ttf", "/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/Hiragino Sans GB.ttc"]:
        if Path(p).exists():
            font_manager.fontManager.addfont(p)
            picked = font_manager.FontProperties(fname=p).get_name()
            break
plt.rcParams["font.sans-serif"] = [picked, "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

BLUE, GRAY, ACCENT = "#3b6fb6", "#9aa5b1", "#e8743b"
warnings.filterwarnings("error", message=".*missing from font.*")  # 字体缺字直接报错，不静默出豆腐块

NOTE_SAMPLE = "口径：在招岗位（PUBLISHING 且未删除）；学历/经验/薪资/岗位名/城市为主键 1/500 抽样（n≈20,005）"
NOTE_EXACT = "口径：全表精确计数（11,571,009 行，按主键分段/索引范围统计）"


def pct_labels(ax, bars, total, fmt="{:.1%}"):
    for b in bars:
        h = b.get_height()
        if h > 0:
            ax.annotate(fmt.format(h / total) if total else f"{int(h)}",
                        (b.get_x() + b.get_width() / 2, h), ha="center", va="bottom",
                        fontsize=8.5, color="#333")


def hbar(ax, s, title, xlabel="岗位数（抽样）", accent_idx=None, show_pct=True):
    labels = list(s.index)[::-1]
    vals = list(s.values)[::-1]
    colors = [ACCENT if (accent_idx is not None and i == (len(labels) - 1 - accent_idx)) else BLUE
              for i in range(len(labels))]
    bars = ax.barh(labels, vals, color=colors)
    total = sum(vals)
    for b in bars:
        w = b.get_width()
        txt = f"{int(w):,}" + (f"  ({w / total:.1%})" if show_pct and total else "")
        ax.annotate(txt, (w, b.get_y() + b.get_height() / 2), va="center", ha="left",
                    fontsize=8.5, color="#333", xytext=(3, 0), textcoords="offset points")
    ax.set_title(title, fontsize=12, fontweight="bold")
    ax.set_xlabel(xlabel, fontsize=9)
    ax.set_xlim(0, max(vals) * 1.28 if vals else 1)
    ax.spines[["top", "right"]].set_visible(False)


def vbar(ax, cats, vals, title, ylabel, labels=None, accent_idx=None, total_for_pct=None):
    cats = [str(c) for c in cats]
    vals = [int(v) for v in vals]
    colors = [ACCENT if (accent_idx is not None and i in accent_idx) else BLUE for i in range(len(cats))]
    bars = ax.bar(cats, vals, color=colors)
    total = total_for_pct or sum(vals)
    for b, v in zip(bars, vals):
        ax.annotate(f"{v:,}\n({v / total:.1%})" if total else f"{v:,}",
                    (b.get_x() + b.get_width() / 2, v), ha="center", va="bottom", fontsize=8, color="#333")
    ax.set_title(title, fontsize=12, fontweight="bold")
    ax.set_ylabel(ylabel, fontsize=9)
    ax.set_ylim(0, max(vals) * 1.22 if vals else 1)
    ax.tick_params(axis="x", labelsize=9)
    ax.spines[["top", "right"]].set_visible(False)


def read(name):
    return pd.read_csv(DATA / name, sep="\t")


# ================= 图 1：全国概览 =================
src = read("src.tsv").groupby("data_source", as_index=False)["cnt"].sum().sort_values("cnt", ascending=False)
top = src.head(8).copy()
rest = src.iloc[8:]["cnt"].sum()
if rest > 0:
    top = pd.concat([top, pd.DataFrame([{"data_source": "其他(高校就业网等)", "cnt": rest}])],
                    ignore_index=True)

monthly = read("monthly.tsv")
edu_map = {"BUXIAN": "不限", "ZHONGZHUAN/ZHONGJI": "中专/中技", "CHUZHONGJIYIXIA": "初中及以下",
           "GAOZHONG": "高中", "DAZHUAN": "大专", "GAOZHI": "高职", "BENKE": "本科",
           "SHUOSHI": "硕士", "BOSHI": "博士"}
edu = read("edu.tsv").query("education != 'NULL'").assign(k=lambda d: d.education.map(edu_map)).dropna(subset=["k"])
edu = edu.groupby("k")["cnt"].sum().sort_values(ascending=False)

exp_map = {"BUXIAN": "不限", "GRADUATING": "应届生", "ON_CAMPUS": "在校生", "LESS_THAN_1": "1年以内",
           "LESS_THAN_3": "3年以内", "LESS_THAN_5": "5年以内", "LESS_THAN_10": "10年以内",
           "MORE_THAN_10": "10年以上"}
exp = read("exp.tsv").query("experience in @exp_map.keys()").assign(k=lambda d: d.experience.map(exp_map))
order = ["不限", "1年以内", "3年以内", "5年以内", "10年以内", "10年以上", "应届生", "在校生"]
exp = exp.groupby("k")["cnt"].sum().reindex(order).dropna()

fig, axes = plt.subplots(2, 2, figsize=(14, 10.5), constrained_layout=True)
fig.get_layout_engine().set(rect=(0, 0.045, 1, 0.96))
hbar(axes[0, 0], top.set_index("data_source")["cnt"], "1. 数据来源构成（全量 1,157 万行）",
     xlabel="岗位数（全量）", accent_idx=0)
axm = axes[0, 1]
mv = [int(v) for v in monthly["cnt"]]
axm.bar(monthly["m"], mv, color=[ACCENT if m in ("2026-06", "2026-07") else BLUE for m in monthly["m"]])
axm.set_yscale("log")
axm.set_ylim(8, max(mv) * 8)
for x_, v in zip(monthly["m"], mv):
    axm.annotate(f"{v / 10000:.0f}万" if v >= 10000 else f"{v}", (x_, v),
                 ha="center", va="bottom", fontsize=8, color="#333")
axm.set_title("2. 数据更新批次（按月，对数轴）", fontsize=12, fontweight="bold")
axm.set_ylabel("变更行数（全量）", fontsize=9)
axm.tick_params(axis="x", rotation=60)
axm.spines[["top", "right"]].set_visible(False)
vbar(axes[1, 0], list(edu.index), list(edu.values), "3. 学历要求分布（在招）", "岗位数（抽样）")
axes[1, 0].tick_params(axis="x", rotation=30)
vbar(axes[1, 1], list(exp.index), list(exp.values), "4. 经验要求分布（在招）", "岗位数（抽样）")
fig.suptitle("c_company_position 主表分析 · 全国概览", fontsize=16, fontweight="bold")
fig.text(0.01, 0.005, "1. 2. " + NOTE_EXACT + "；3. 4. " + NOTE_SAMPLE, fontsize=8, color="#777")
fig.savefig(OUT / "fig1_全国概览.png", dpi=150)
plt.close(fig)

# ================= 图 2：岗位画像与地域 =================
sal_order = ["<3K", "3-6K", "6-10K", "10-15K", "15-25K", "25-50K", "50K+"]
sal = read("salary.tsv").query("bucket in @sal_order").groupby("bucket")["cnt"].sum().reindex(sal_order)

names = read("topnames.tsv").set_index("name")["cnt"]

prov = read("prov.tsv").query("province != 'NULL'").head(12)
gd_share = prov.loc[prov.province == "广东省", "cnt"].iloc[0] / read("prov.tsv").query("province != 'NULL'")["cnt"].sum()

city = read("gd_city.tsv").set_index("city")["cnt"]

fig, axes = plt.subplots(2, 2, figsize=(14, 10.5), constrained_layout=True)
fig.get_layout_engine().set(rect=(0, 0.04, 1, 0.96))
vbar(axes[0, 0], list(sal.index), list(sal.values), "5. 薪资下限分桶（在招，单位 K/月）", "岗位数（抽样）")
axes[0, 0].tick_params(axis="x", rotation=30)
hbar(axes[0, 1], names, "6.  岗位名 Top15（在招）")
hbar(axes[1, 0], prov.set_index("province")["cnt"], f"7.  在招岗位省份 Top12（广东占 {gd_share:.1%}，≈147 万条）")
hbar(axes[1, 1], city, "8.  广东 21 市在招岗位分布（抽样）")
fig.suptitle("c_company_position 主表分析 · 岗位画像与地域", fontsize=16, fontweight="bold")
fig.text(0.01, 0.005, NOTE_SAMPLE + "；城市经 company_address_id 关联地址表（解析率 99.98%）", fontsize=8, color="#777")
fig.savefig(OUT / "fig2_岗位画像与地域.png", dpi=150)
plt.close(fig)

# ================= 图 3：AI 岗位切片 =================
ai_sal = read("ai_salary.tsv").query("bucket in @sal_order")
piv = (ai_sal.pivot_table(index="bucket", columns="grp", values="cnt", aggfunc="sum")
       .reindex(sal_order).fillna(0))
piv_pct = piv / piv.sum()

ai_edu = read("ai_edu.tsv").query("education in @edu_map.keys()")
edu_p = (ai_edu.assign(k=lambda d: d.education.map(edu_map))
         .pivot_table(index="k", columns="grp", values="cnt", aggfunc="sum").fillna(0))
edu_p_pct = edu_p / edu_p.sum()
edu_p_pct = edu_p_pct.reindex(edu_p_pct["ALL"].sort_values(ascending=False).index)

ai_prov = read("ai_prov.tsv").set_index("province")["cnt"]

fig, axes = plt.subplots(1, 3, figsize=(17, 5.8), constrained_layout=True)
fig.get_layout_engine().set(rect=(0, 0.07, 1, 0.93))
x = range(len(piv))
w = 0.38
axes[0].bar([i - w / 2 for i in x], piv_pct["ALL"] * 100, w, color=GRAY, label="全部在招岗位")
axes[0].bar([i + w / 2 for i in x], piv_pct["AI"] * 100, w, color=ACCENT, label="AI 命名岗位")
for i, v in enumerate(piv_pct["ALL"] * 100):
    axes[0].annotate(f"{v:.0f}%", (i - w / 2, v), ha="center", va="bottom", fontsize=8, color="#555")
for i, v in enumerate(piv_pct["AI"] * 100):
    axes[0].annotate(f"{v:.0f}%", (i + w / 2, v), ha="center", va="bottom", fontsize=8, color=ACCENT)
axes[0].set_xticks(list(x)); axes[0].set_xticklabels(list(piv.index), rotation=30)
axes[0].set_title("9.  薪资结构：AI 岗 vs 全部（占比）", fontsize=12, fontweight="bold")
axes[0].set_ylabel("占比 %"); axes[0].legend(fontsize=9)
axes[0].spines[["top", "right"]].set_visible(False)

xe = range(len(edu_p_pct))
axes[1].bar([i - w / 2 for i in xe], edu_p_pct["ALL"] * 100, w, color=GRAY, label="全部在招岗位")
axes[1].bar([i + w / 2 for i in xe], edu_p_pct["AI"] * 100, w, color=ACCENT, label="AI 命名岗位")
for i, v in enumerate(edu_p_pct["ALL"] * 100):
    axes[1].annotate(f"{v:.0f}%", (i - w / 2, v), ha="center", va="bottom", fontsize=8, color="#555")
for i, v in enumerate(edu_p_pct["AI"] * 100):
    axes[1].annotate(f"{v:.0f}%", (i + w / 2, v), ha="center", va="bottom", fontsize=8, color=ACCENT)
axes[1].set_xticks(list(xe)); axes[1].set_xticklabels(list(edu_p_pct.index), rotation=30)
axes[1].set_title("10.  学历结构：AI 岗 vs 全部（占比）", fontsize=12, fontweight="bold")
axes[1].set_ylabel("占比 %"); axes[1].legend(fontsize=9)
axes[1].spines[["top", "right"]].set_visible(False)

hbar(axes[2], ai_prov, "11.  AI 命名岗位省份 Top10（抽样）", accent_idx=0)

fig.suptitle("c_company_position 主表分析 · AI 岗位切片", fontsize=16, fontweight="bold")
fig.text(0.01, 0.005, "口径：在招岗位主键 1/100 抽样（n≈101,467，其中 AI 命名岗位 717 条）；"
                      "AI=岗位名含 算法/机器学习/深度学习/大模型/AIGC/NLP/自然语言/CV/语音识别/人工智能/自动驾驶 等词",
         fontsize=8, color="#777")
fig.savefig(OUT / "fig3_AI岗位切片.png", dpi=150)
plt.close(fig)

print("font:", picked)
for f in ["fig1_全国概览.png", "fig2_岗位画像与地域.png", "fig3_AI岗位切片.png"]:
    p = OUT / f
    print(f, p.stat().st_size // 1024, "KB")
