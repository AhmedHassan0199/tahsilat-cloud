import json
import sqlite3
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "tahsilat_system" / "data" / "tahsilat.sqlite3"
OUT = Path(__file__).resolve().parents[1] / "exports" / "current_data.sql"


def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert(table, columns, row):
    values = ", ".join(q(row[col]) for col in columns)
    cols = ", ".join(columns)
    return f"INSERT INTO {table} ({cols}) VALUES ({values});"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    lines = [
        "DELETE FROM audit_logs;",
        "DELETE FROM collections;",
        "DELETE FROM expenses;",
        "DELETE FROM payment_methods;",
        "DELETE FROM sessions;",
        "DELETE FROM users WHERE username <> 'admin';",
    ]

    for table in ["payment_methods", "collections", "expenses"]:
        rows = con.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
        if not rows:
            continue
        columns = [col for col in rows[0].keys() if col != "id"]
        for row in rows:
            lines.append(insert(table, columns, row))

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUT), "lines": len(lines)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
