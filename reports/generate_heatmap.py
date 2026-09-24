#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 06-广东岗位热力图数据.md 生成离线 SVG/HTML 热力图。"""

from __future__ import annotations

import html
import json
import math
import re
from pathlib import Path


BASE = Path(__file__).parent
SOURCE = BASE / "06-广东岗位热力图数据.md"
BOUNDARY = BASE / "guangdong_440000_full.geojson"
SVG_OUT = BASE / "06-广东岗位热力图.svg"
HTML_OUT = BASE / "06-广东岗位热力图.html"

PALETTE = ["#e7f0fa", "#b6d2ec", "#78acd3", "#3f7fb4", "#1e4d7c"]
INK = "#172b4d"
MUTED = "#5e718d"


def read_city_rows() -> tuple[list[tuple[str, int, float]], int]:
    text = SOURCE.read_text(encoding="utf-8")
    section = text.split("## 广东各城市在招岗位分布", 1)[1]
    rows: list[tuple[str, int, float]] = []
    document_total = None
    for line in section.splitlines():
        total_match = re.match(r"\|\s*\|\s*\*\*合计\*\*\s*\|\s*\*\*([\d,]+)\*\*", line)
        if total_match and rows:
            document_total = int(total_match.group(1).replace(",", ""))
            break
        m = re.match(r"\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d,]+)\s*\|\s*([\d.]+)%\s*\|", line)
        if not m:
            continue
        city = m.group(1).strip()
        count = int(m.group(2).replace(",", ""))
        share = float(m.group(3)) / 100
        rows.append((city, count, share))
    if len(rows) != 21 or document_total is None:
        raise ValueError(f"预期解析 21 个城市，实际得到 {len(rows)} 个")
    return rows, document_total


def fmt_count(value: int) -> str:
    return f"{value:,}"


def fmt_wan(value: int) -> str:
    return f"{value / 10000:.1f}万"


def colour_index(value: int, lo: float, step: float) -> int:
    # 色阶按 log10 等距切分，降低深圳/广州对小城市的视觉压制。
    idx = int((math.log10(value) - lo) / step) if step else 0
    return max(0, min(len(PALETTE) - 1, idx))


def project(lon: float, lat: float, bounds: tuple[float, float, float, float], box: tuple[float, float, float, float]) -> tuple[float, float]:
    min_lon, max_lon, min_lat, max_lat = bounds
    x0, y0, w, h = box
    x = x0 + (lon - min_lon) / (max_lon - min_lon) * w
    y = y0 + (max_lat - lat) / (max_lat - min_lat) * h
    return x, y


def geometry_path(geometry: dict, bounds: tuple[float, float, float, float], box: tuple[float, float, float, float]) -> str:
    def ring_path(ring: list[list[float]]) -> str:
        points = [project(point[0], point[1], bounds, box) for point in ring]
        if not points:
            return ""
        return "M " + " ".join(f"{x:.2f},{y:.2f}" for x, y in points) + " Z"

    coords = geometry.get("coordinates", [])
    if geometry.get("type") == "Polygon":
        return " ".join(ring_path(ring) for ring in coords)
    if geometry.get("type") == "MultiPolygon":
        return " ".join(ring_path(ring) for polygon in coords for ring in polygon)
    return ""


def build_svg(rows: list[tuple[str, int, float]], document_total: int) -> str:
    if not BOUNDARY.exists():
        raise FileNotFoundError(f"缺少广东城市边界文件：{BOUNDARY}")
    geo = json.loads(BOUNDARY.read_text(encoding="utf-8"))
    row_map = {city: (value, share) for city, value, share in rows}
    features = geo.get("features", [])
    matched = {}
    all_points = []

    def collect_points(value):
        if isinstance(value, list):
            if len(value) >= 2 and all(isinstance(v, (int, float)) for v in value[:2]):
                all_points.append((float(value[0]), float(value[1])))
            else:
                for child in value:
                    collect_points(child)

    for feature in features:
        props = feature.get("properties", {})
        city = str(props.get("name", "")).removesuffix("市")
        if city in row_map:
            matched[city] = feature
        center = props.get("center") or props.get("centroid")
        if center:
            all_points.append((float(center[0]), float(center[1])))
        collect_points(feature.get("geometry", {}).get("coordinates", []))
    if len(matched) != 21:
        missing = sorted(set(row_map) - set(matched))
        raise ValueError(f"边界文件未匹配 21 个城市，缺少：{missing}")

    # 用所有城市中心点确定视窗，给边缘留少量空间。
    min_lon = min(p[0] for p in all_points) - 0.35
    max_lon = max(p[0] for p in all_points) + 0.35
    min_lat = min(p[1] for p in all_points) - 0.35
    max_lat = max(p[1] for p in all_points) + 0.35
    bounds = (min_lon, max_lon, min_lat, max_lat)
    map_box = (72, 188, 860, 700)
    total = sum(value for _, value, _ in rows)
    discrepancy = document_total - total
    lo = math.log10(min(value for _, value, _ in rows))
    hi = math.log10(max(value for _, value, _ in rows))
    step = (hi - lo) / len(PALETTE) if hi > lo else 1

    width, height = 1500, 1030
    top3 = sum(v for _, v, _ in rows[:3]) / total
    right_x = 1000

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        '<title id="title">广东省各城市在招岗位热力图</title>',
        '<desc id="desc">按城市展示广东省全量在招岗位数，颜色越深表示岗位数越多。</desc>',
        '<rect width="100%" height="100%" fill="#f9fbff"/>',
        f'<text x="72" y="66" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" '
        f'font-size="34" font-weight="700" fill="{INK}">广东省各城市在招岗位热力图</text>',
        f'<text x="72" y="104" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" '
        f'font-size="17" fill="{MUTED}">城市分区着色 + 城市中心点热力 · 颜色按 log₁₀ 等距分箱 · 查询时间：2026-09-20</text>',
        f'<rect x="72" y="132" width="270" height="42" rx="10" fill="#eef4fb"/>',
        f'<text x="94" y="159" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="15" fill="{MUTED}">城市表合计：<tspan font-weight="700" fill="{INK}">{fmt_count(total)}</tspan></text>',
        f'<rect x="360" y="132" width="270" height="42" rx="10" fill="#eef4fb"/>',
        f'<text x="382" y="159" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="15" fill="{MUTED}">最高：<tspan font-weight="700" fill="{INK}">{rows[0][0]} {fmt_wan(rows[0][1])}</tspan></text>',
        f'<rect x="648" y="132" width="270" height="42" rx="10" fill="#fff4e8"/>',
        f'<text x="670" y="159" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="15" fill="{MUTED}">文档基数差额：<tspan font-weight="700" fill="#9a5b12">{discrepancy:+,}</tspan></text>',
    ]

    # 城市行政区底图：每个地市一块色阶，城市中心叠加气泡。
    for feature in features:
        props = feature.get("properties", {})
        city = str(props.get("name", "")).removesuffix("市")
        value, share = row_map[city]
        fill = PALETTE[colour_index(value, lo, step)]
        d = geometry_path(feature.get("geometry", {}), bounds, map_box)
        parts.append(f'<path d="{d}" fill="{fill}" stroke="#ffffff" stroke-width="1.5" fill-rule="evenodd"><title>{html.escape(city)}：{fmt_count(value)} 个岗位（{share:.1%}）</title></path>')

    max_value = max(value for _, value, _ in rows)
    for rank, (city, value, share) in enumerate(rows, start=1):
        feature = matched[city]
        props = feature.get("properties", {})
        center = props.get("center") or props.get("centroid")
        cx, cy = project(float(center[0]), float(center[1]), bounds, map_box)
        radius = 6 + 24 * math.sqrt(value / max_value)
        parts.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{radius:.2f}" fill="#f47b52" fill-opacity="0.82" stroke="#ffffff" stroke-width="2"><title>{html.escape(city)}：{fmt_count(value)} 个岗位（{share:.1%}）</title></circle>')
        # 只在地图上直接标注主要城市，其余城市通过悬停标题和右侧排行查阅。
        if rank <= 8:
            dx = 10 if cx < map_box[0] + map_box[2] * 0.72 else -10
            anchor = "start" if dx > 0 else "end"
            parts.append(f'<text x="{cx + dx:.2f}" y="{cy - radius - 4:.2f}" text-anchor="{anchor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="13" font-weight="700" fill="{INK}">{html.escape(city)} {fmt_wan(value)}</text>')

    parts.append(f'<text x="72" y="{map_box[1] + map_box[3] + 32}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="14" fill="{MUTED}">行政区颜色：岗位数；橙色圆点：城市中心与岗位量（圆越大，岗位越多）</text>')

    # 右侧：色阶、气泡图例和 Top 8 排名。
    parts.append(f'<text x="{right_x}" y="220" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="18" font-weight="700" fill="{INK}">岗位数色阶</text>')
    for i, fill in enumerate(PALETTE):
        x = right_x + (i % 2) * 210
        y = 246 + (i // 2) * 32
        lower = 10 ** (lo + step * i)
        upper = 10 ** (lo + step * (i + 1)) if i < len(PALETTE) - 1 else 10 ** hi
        parts.extend([
            f'<rect x="{x}" y="{y}" width="24" height="18" rx="3" fill="{fill}"/>',
            f'<text x="{x + 32}" y="{y + 14}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="12" fill="{MUTED}">{fmt_wan(round(lower))}–{fmt_wan(round(upper))}</text>',
        ])

    parts.append(f'<text x="{right_x}" y="340" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="18" font-weight="700" fill="{INK}">Top 8 城市</text>')
    for rank, (city, value, share) in enumerate(rows[:8], start=1):
        y = 370 + (rank - 1) * 34
        parts.extend([
            f'<text x="{right_x}" y="{y}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="14" fill="{MUTED}">{rank:02d}</text>',
            f'<text x="{right_x + 38}" y="{y}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="15" font-weight="600" fill="{INK}">{html.escape(city)}</text>',
            f'<text x="{right_x + 120}" y="{y}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="14" fill="{MUTED}">{fmt_count(value)} · {share:.1%}</text>',
        ])

    note_y = 930
    parts.extend([
        f'<line x1="72" y1="{note_y - 22}" x2="1428" y2="{note_y - 22}" stroke="#d9e2ef"/>',
        f'<text x="72" y="{note_y}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="13" fill="{MUTED}">口径：企业地址表 province=广东省 且 deleted=0，岗位 publish_state=PUBLISHING 且 deleted=0，按岗位主键去重。</text>',
        f'<text x="72" y="{note_y + 24}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI, sans-serif" font-size="13" fill="{MUTED}">来源：06-广东岗位热力图数据.md；城市行合计 {fmt_count(total)}，文档全量基数 {fmt_count(document_total)}，差额 {discrepancy:+,}，需回查原始聚合口径。边界：阿里云 DataV 行政区 GeoJSON。</text>',
        '</svg>',
    ])
    return "".join(parts)


def main() -> None:
    rows, document_total = read_city_rows()
    svg = build_svg(rows, document_total)
    SVG_OUT.write_text(svg, encoding="utf-8")
    HTML_OUT.write_text(
        "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>广东省各城市在招岗位热力图</title>"
        "<style>html,body{margin:0;background:#f9fbff}main{max-width:1500px;margin:0 auto;padding:16px}svg{width:100%;height:auto;display:block}</style>"
        f"</head><body><main>{svg}</main></body></html>",
        encoding="utf-8",
    )
    print(f"parsed {len(rows)} cities; city_total={sum(v for _, v, _ in rows):,}; document_total={document_total:,}")
    print(SVG_OUT)
    print(HTML_OUT)


if __name__ == "__main__":
    main()
