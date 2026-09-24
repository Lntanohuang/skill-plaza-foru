# -*- coding: utf-8 -*-
"""高职切片汇总：从 gz_*.tsv 聚合出薪资分桶/分位数/热门岗位中位薪资等派生数据。纯 stdlib。"""
import csv
from pathlib import Path

DATA = Path(__file__).parent


def read_tsv(name):
    with open(DATA / name, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def pct_from_dist(dist, p):
    """dist: [(value, cnt)] 升序；返回加权分位数（线性插值）。"""
    total = sum(c for _, c in dist)
    if total == 0:
        return None
    target = (total - 1) * p  # 与 numpy percentile linear 一致
    cum = 0
    for i, (v, c) in enumerate(dist):
        nxt = cum + c
        if nxt > target:
            if i == 0:
                return v
            v0, c0 = dist[i - 1]
            # 在 [cum-1, nxt-1] 索引区间内线性插值到 target
            frac = (target - (cum - 1)) / (nxt - (cum - 1))
            return v0 + (v - v0) * frac
        cum = nxt
    return dist[-1][0]


def bucket_of(mid):
    if mid == 0:
        return "面议/无值(0)"
    if mid < 0:
        return "脏值(负值)"
    if mid > 100:
        return "脏值(>100K)"
    if mid < 3:
        return "<3K"
    if mid < 6:
        return "3-6K"
    if mid < 10:
        return "6-10K"
    if mid < 15:
        return "10-15K"
    if mid < 25:
        return "15-25K"
    return "25K+"


BUCKET_ORDER = ["<3K", "3-6K", "6-10K", "10-15K", "15-25K", "25K+",
                "面议/无值(0)", "脏值(>100K)", "脏值(负值)"]
GRP_NAME = {"core": "高职核心(DAZHUAN+GAOZHI)", "wide_rest": "宽口径补集(中专/高中/不限)",
            "wide": "高职可投宽口径", "full": "全量在招"}

# ---------- 薪资分桶 + 分位数 ----------
dist_rows = read_tsv("gz_salary_dist.tsv")
by_grp = {}
for r in dist_rows:
    by_grp.setdefault(r["grp"], []).append((float(r["rmid"]), int(r["cnt"])))
for g in by_grp:
    by_grp[g].sort()

merged = {"core": by_grp["core"], "wide": by_grp["core"] + by_grp["wide_rest"],
          "full": by_grp["core"] + by_grp["wide_rest"] + by_grp["above"]}
for g in merged:
    merged[g].sort()

with open(DATA / "gz_salary_bucket.tsv", "w", encoding="utf-8") as f:
    f.write("grp\tbucket\tcnt\n")
    for g in ("core", "wide", "full"):
        buckets = {}
        for v, c in merged[g]:
            buckets[bucket_of(v)] = buckets.get(bucket_of(v), 0) + c
        for b in BUCKET_ORDER:
            if b in buckets:
                f.write(f"{g}\t{b}\t{buckets[b]}\n")

stats = {}
with open(DATA / "gz_salary_stats.tsv", "w", encoding="utf-8") as f:
    f.write("grp\tn_valid\tp25\tmedian\tp75\tshare_valid\n")
    for g in ("core", "wide", "full"):
        valid = [(v, c) for v, c in merged[g] if 0 < v <= 100]
        n_valid = sum(c for _, c in valid)
        n_all = sum(c for _, c in merged[g])
        s = {q: pct_from_dist(valid, q) for q in (0.25, 0.5, 0.75)}
        stats[g] = {"n_valid": n_valid, "n_all": n_all, 0.25: s[0.25], 0.5: s[0.5], 0.75: s[0.75]}
        f.write(f"{g}\t{n_valid}\t{s[0.25]:.2f}\t{s[0.5]:.2f}\t{s[0.75]:.2f}\t{n_valid / n_all:.4f}\n")

# ---------- TOP20 岗位中位薪资 ----------
per_name = {}
for r in read_tsv("gz_topname_salary.tsv"):
    per_name.setdefault(r["name"], []).append((float(r["rmid"]), int(r["cnt"])))
order = [r["name"] for r in read_tsv("gz_topnames.tsv")[:20]]
with open(DATA / "gz_topname_median.tsv", "w", encoding="utf-8") as f:
    f.write("name\tcnt_valid\tmedian\tp25\tp75\n")
    for name in order:
        d = sorted(per_name.get(name, []))
        med = pct_from_dist(d, 0.5)
        p25 = pct_from_dist(d, 0.25)
        p75 = pct_from_dist(d, 0.75)
        n = sum(c for _, c in d)
        f.write(f"{name}\t{n}\t{med:.2f}\t{p25:.2f}\t{p75:.2f}\n")

# ---------- 汇总打印 ----------
edu = {r["education"]: int(r["cnt"]) for r in read_tsv("gz_edu_full.tsv")}
total_all = sum(edu.values())
core_n = edu["DAZHUAN"] + edu["GAOZHI"]
wide_n = core_n + edu["ZHONGZHUAN/ZHONGJI"] + edu["GAOZHONG"] + edu["BUXIAN"]
print(f"在招总量={total_all:,} 核心切片={core_n:,}({core_n/total_all:.1%}) "
      f"宽口径={wide_n:,}({wide_n/total_all:.1%})")
prov = read_tsv("gz_prov.tsv")
prov_top = [r for r in prov if r["province"].endswith(("省", "市", "区")) or "自治区" in r["province"]]
joined = sum(int(r["cnt"]) for r in prov)
print(f"地域join覆盖={joined:,}/{core_n:,} = {joined/core_n:.2%}; 省份干净条目={len(prov_top)}, 脏值行={len(prov)-len(prov_top)}")
for g in ("core", "wide", "full"):
    s = stats[g]
    print(f"{GRP_NAME[g]}: 有效薪资 {s['n_valid']:,} 条({s['n_valid']/s['n_all']:.1%}), "
          f"P25={s[0.25]:.1f}K 中位={s[0.5]:.1f}K P75={s[0.75]:.1f}K")
# 分桶占比（供核心结论）
for g in ("core", "full"):
    buckets = {}
    for v, c in merged[g]:
        buckets[bucket_of(v)] = buckets.get(bucket_of(v), 0) + c
    tot = sum(buckets.values())
    print(g, {b: f"{c/tot:.1%}" for b, c in sorted(buckets.items(), key=lambda x: -x[1])})
