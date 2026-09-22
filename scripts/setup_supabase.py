import os
import re
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
SQL_PATH = ROOT_DIR / "scripts" / "init_supabase.sql"

def clean_database_url(url: str) -> str:
    if not url:
        return ""
    u = url.strip().strip("'\"")
    # 清理誤填的括號與 https:// 前綴
    # 例如 postgresql://postgres:[pwd]@db.[https://ref.supabase.co].supabase.co:5432/postgres
    # 轉為 postgresql://postgres:pwd@db.ref.supabase.co:5432/postgres
    match = re.match(r"postgresql://([^:]+):(?:\[)?([^@\]]+)(?:\])?@(?:db\.)?(?:\[)?(?:https?://)?([a-zA-Z0-9]+)(?:\.supabase\.co)?(?:\])?(?:\.supabase\.co)?:(\d+)/(.+)", u)
    if match:
        user, pwd, ref, port, dbname = match.groups()
        return f"postgresql://{user}:{pwd}@db.{ref}.supabase.co:{port}/{dbname}"
    return u

def main():
    load_dotenv(dotenv_path=ENV_PATH)
    raw_db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not raw_db_url:
        print("❌ 錯誤：未在 .env 中找到 DATABASE_URL", file=sys.stderr)
        sys.exit(1)

    db_url = clean_database_url(raw_db_url)
    sql_content = SQL_PATH.read_text(encoding="utf-8")

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql_content)
        conn.close()
        print("✅ Supabase PostgreSQL 資料庫結構與安全 RLS 原則初始化成功！")
    except psycopg2.Error as e:
        safe_msg = re.sub(r"://([^:]+):([^@]+)@", r"://\1:[REDACTED]@", str(e))
        print(f"❌ 初始化 Supabase 資料庫失敗: {safe_msg}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
