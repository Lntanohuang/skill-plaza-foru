#!/usr/bin/env python3
"""Serve the static demo and proxy Youcai chat requests without exposing its key."""

from __future__ import annotations

import argparse
import http.client
import json
import os
import re
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_KEY_FILE = Path.home() / "VeryVision" / "API" / "API接口密钥.txt"
UPSTREAM_URL = "http://8.134.216.249:19111/v1/chat/completions"
UPSTREAM_MODEL = "youcai"
MAX_BODY_BYTES = 512_000

SKILL_PROMPTS = {
    "industry-education-report": (
        "你正在按 industry-education-report SKILL 工作。面向院校管理者、政府部门或产业园区，"
        "围绕区域产业、岗位人才、重点企业、就业去向、专业课程与招商形成有证据的决策分析。"
        "明确区分事实、推断、建议和缺失数据；所有统计结论都提示核验年份、范围、口径和来源；"
        "资料不足时保留缺口，不编造数字。先确认任务对象、地区、报告用途和基期，再推进交付。"
    ),
    "classroom-assistant": (
        "你正在按 classroom-assistant SKILL 工作。只在用户明确提供或授权的课程资料范围内完成"
        "带定位引用的答疑、课堂要点、练习和答疑记录整理。资料不足或问题越界时，明确说明缺口，"
        "不要用模型记忆补充课程事实，并把待确认事项整理给教师。"
    ),
    "ai-interview": (
        "你正在按 ai-interview SKILL 工作。根据目标岗位、岗位要求和用户简历开展交互式模拟面试。"
        "一次只问一题，根据用户的真实回答智能追问；不要替用户作答。练习结束后引用用户回答原文，"
        "按能力维度给出证据化复盘、待验证项和可执行的改进建议。评分不代表录用概率。"
    ),
    "training-data-qa": (
        "你正在按 training-data-qa SKILL 工作。根据治理数据、任务模板和标注规则构造黄金种子、"
        "扩增样本与难例，规划训练/验证/测试/独立评测划分，并检查 Schema、事实证据、业务规则、"
        "重复、泄漏和分布。未经专家确认的结果只能标为候选；负责数据构造与验收，不执行模型训练。"
    ),
}


def load_api_key(key_file: Path) -> str:
    """Load a gateway key from env or a local file outside the public repo."""
    env_key = os.environ.get("YOUCAI_API_KEY", "").strip()
    if env_key:
        return env_key
    try:
        text = key_file.read_text(encoding="utf-8-sig")
    except OSError:
        return ""
    match = re.search(r"(?:gw|sk)-[A-Za-z0-9_-]+", text)
    return match.group(0) if match else ""


def clean_messages(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise ValueError("请至少输入一条消息。")
    if len(value) > 20:
        raise ValueError("单次对话最多保留 20 条消息。")
    cleaned: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
            raise ValueError("消息格式不正确。")
        content = item.get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("消息内容不能为空。")
        if len(content) > 20_000:
            raise ValueError("单条消息不能超过 20000 个字符。")
        cleaned.append({"role": item["role"], "content": content.strip()})
    return cleaned


class SkillPlazaHandler(SimpleHTTPRequestHandler):
    api_key = ""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        # Keep the usual useful request log while never logging request bodies or headers.
        super().log_message(format, *args)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json(
                {
                    "ok": bool(self.api_key),
                    "model": UPSTREAM_MODEL,
                    "message": "API 已配置" if self.api_key else "未找到 API 密钥",
                }
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self.send_json({"error": "接口不存在。"}, HTTPStatus.NOT_FOUND)
            return
        if not self.api_key:
            self.send_json(
                {"error": "未找到 API 密钥。请设置 YOUCAI_API_KEY，或确认本机 API 密钥文档存在。"},
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        try:
            origin = self.headers.get("Origin")
            if origin:
                port = self.server.server_address[1]
                allowed_origins = {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}
                if origin.rstrip("/") not in allowed_origins:
                    self.send_json({"error": "不允许跨站调用本地 API。"}, HTTPStatus.FORBIDDEN)
                    return
            if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
                raise ValueError("请求必须使用 application/json。")
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                raise ValueError("请求内容为空或过大。")
            body = json.loads(self.rfile.read(content_length))
            skill = body.get("skill")
            if skill not in SKILL_PROMPTS:
                raise ValueError("请选择有效的 SKILL。")
            messages = clean_messages(body.get("messages"))
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        upstream_body = json.dumps(
            {
                "model": UPSTREAM_MODEL,
                "messages": [{"role": "system", "content": SKILL_PROMPTS[skill]}, *messages],
            },
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            UPSTREAM_URL,
            data=upstream_body,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            # The documented endpoint is a direct LAN-style HTTP address. Ignore any
            # macOS system proxy so it is not accidentally sent to a local proxy port.
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(request, timeout=600) as response:
                result = json.loads(response.read())
            content = result["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise ValueError("上游响应缺少文本内容。")
            self.send_json({"content": content, "model": UPSTREAM_MODEL})
        except urllib.error.HTTPError as exc:
            self.send_json(
                {"error": f"模型接口返回 HTTP {exc.code}，请稍后重试。"},
                HTTPStatus.BAD_GATEWAY,
            )
        except (urllib.error.URLError, http.client.RemoteDisconnected, ConnectionError, TimeoutError):
            self.send_json({"error": "模型接口连接超时或不可达。"}, HTTPStatus.GATEWAY_TIMEOUT)
        except (KeyError, ValueError, json.JSONDecodeError):
            self.send_json({"error": "模型接口返回了无法识别的数据。"}, HTTPStatus.BAD_GATEWAY)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local SKILL Plaza demo and API proxy.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--key-file", type=Path, default=DEFAULT_KEY_FILE)
    args = parser.parse_args()

    SkillPlazaHandler.api_key = load_api_key(args.key_file)
    server = ThreadingHTTPServer((args.host, args.port), SkillPlazaHandler)
    status = "已加载" if SkillPlazaHandler.api_key else "未找到"
    print(f"SKILL 广场：http://{args.host}:{args.port}/")
    print(f"API 密钥：{status}（不会发送到浏览器）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
