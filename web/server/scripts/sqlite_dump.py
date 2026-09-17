#!/usr/bin/env python3
"""zcode 会话库只读导出（node:sqlite 不可用时的兜底）。
用法：python3 sqlite_dump.py <db路径> <sessionId>   → stdout 输出 trace JSON"""

import json
import sqlite3
import sys


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: sqlite_dump.py <db> <sessionId>", file=sys.stderr)
        raise SystemExit(2)
    db_path, sid = sys.argv[1], sys.argv[2]
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)

    def all_rows(sql, *args):
        return con.execute(sql, args).fetchall()

    meta = all_rows(
        "SELECT id, title, directory, time_created, time_updated, trace_id"
        " FROM session WHERE id = ?", sid
    )
    if not meta:
        print(f"session not found: {sid}", file=sys.stderr)
        raise SystemExit(1)
    m = meta[0]
    messages = all_rows(
        "SELECT id, sequence, time_created, data FROM message"
        " WHERE session_id = ? ORDER BY sequence, time_created", sid
    )
    parts = all_rows(
        "SELECT p.message_id, p.sequence, p.data FROM part p"
        " WHERE p.session_id = ? ORDER BY p.message_id, p.sequence", sid
    )
    tools = all_rows(
        "SELECT tool_name, status, read_only, started_at FROM tool_usage"
        " WHERE session_id = ? ORDER BY started_at", sid
    )

    by_msg: dict = {}
    for mid, _seq, data in parts:
        by_msg.setdefault(mid, []).append(json.loads(data))

    trace = {
        "session": {
            "id": m[0], "title": m[1], "workspace": m[2],
            "created": __import__("datetime").datetime.fromtimestamp(m[3] / 1000).isoformat(),
            "updated": __import__("datetime").datetime.fromtimestamp(m[4] / 1000).isoformat(),
            "trace_id": m[5],
        },
        "summary": {
            "messages": len(messages),
            "toolCalls": [
                {"tool": t[0], "status": t[1], "read_only": bool(t[2]),
                 "started": __import__("datetime").datetime.fromtimestamp(t[3] / 1000).isoformat()}
                for t in tools
            ],
        },
        "messages": [
            {"seq": seq, "time": __import__("datetime").datetime.fromtimestamp(tc / 1000).isoformat(),
             "role": (json.loads(data) or {}).get("role"), "parts": by_msg.get(mid, [])}
            for mid, seq, tc, data in messages
        ],
    }
    json.dump(trace, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
