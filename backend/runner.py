"""Run candidate code against a problem's tests in a subprocess.

Local-demo only: this executes user code on the host. For a hosted deployment, swap this for
Bedrock AgentCore Code Interpreter or another real sandbox.
"""

import json
import subprocess
import sys
import tempfile

from problems import PROBLEMS

HARNESS = """
import json, sys, traceback
results = []
try:
    exec(compile(open(sys.argv[1]).read(), "solution.py", "exec"), globals())
    fn = globals()[{fn!r}]
except Exception:
    print(json.dumps({{"error": traceback.format_exc(limit=2)}}))
    sys.exit(0)
for args, expected in json.loads({tests!r}):
    try:
        got = fn(*args)
        results.append({{"input": args, "expected": expected, "got": got, "passed": got == expected}})
    except Exception as e:
        results.append({{"input": args, "expected": expected, "got": f"{{type(e).__name__}}: {{e}}", "passed": False}})
print(json.dumps({{"results": results}}, default=str))
"""


def run_code(problem_id: str, code: str, timeout: float = 5.0) -> dict:
    problem = PROBLEMS[problem_id]
    harness = HARNESS.format(fn=problem["function"], tests=json.dumps(problem["tests"]))
    with tempfile.TemporaryDirectory() as tmp:
        sol = f"{tmp}/solution.py"
        with open(sol, "w") as f:
            f.write(code)
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-c", harness, sol],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tmp,
            )
        except subprocess.TimeoutExpired:
            return {"error": f"Timed out after {timeout:.0f}s (infinite loop?)", "results": [], "passed": 0, "total": len(problem["tests"])}

    try:
        out = json.loads(proc.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError):
        out = {"error": (proc.stderr or proc.stdout or "No output")[-1500:]}

    results = out.get("results", [])
    return {
        "error": out.get("error"),
        "results": results,
        "passed": sum(r["passed"] for r in results),
        "total": len(problem["tests"]),
        "stderr": proc.stderr[-1000:] if proc.stderr else "",
    }


def _norm_rows(rows: list[tuple]) -> list[tuple]:
    return sorted(tuple(round(v, 2) if isinstance(v, float) else v for v in r) for r in rows)


def run_sql(problem_id: str, query: str, timeout: float = 3.0) -> dict:
    """Run a SELECT against an in-memory SQLite copy of the problem's dataset; compare to the reference query."""
    import sqlite3
    import time

    problem = PROBLEMS[problem_id]
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(problem["schema"])
        expected = conn.execute(problem["solution"]).fetchall()
        deadline = time.monotonic() + timeout
        conn.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10_000)
        try:
            cur = conn.execute(query.strip().rstrip(";"))
            got = cur.fetchmany(500)
            columns = [d[0] for d in cur.description or []]
        except sqlite3.Error as e:
            msg = "Query timed out" if "interrupted" in str(e) else f"SQL error: {e}"
            return {"error": msg, "results": [], "passed": 0, "total": 1}
    finally:
        conn.close()

    passed = _norm_rows(got) == _norm_rows(expected)
    return {
        "error": None,
        "results": [{"input": "sample dataset", "expected": expected[:20], "got": got[:20], "passed": passed}],
        "passed": int(passed),
        "total": 1,
        "columns": columns,
        "rows": got[:50],
    }
