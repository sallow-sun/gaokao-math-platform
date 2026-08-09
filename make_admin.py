from pathlib import Path
import sqlite3


database_path = (
    Path(__file__).resolve().parent
    / "userDatabase.db"
)

account = input(
    "请输入要设为管理员的用户名、UID或邮箱："
).strip()

connection = sqlite3.connect(database_path)
connection.row_factory = sqlite3.Row

user = connection.execute("""
    SELECT id, uid, username
    FROM users
    WHERE username = ?
       OR uid = ?
       OR email = ?
    LIMIT 1
""", (
    account,
    account,
    account
)).fetchone()

if user is None:
    connection.close()
    raise SystemExit("没有找到该用户")

connection.execute("""
    UPDATE users
    SET is_admin = 1
    WHERE id = ?
""", (user["id"],))

connection.commit()
connection.close()

print(
    f"已将 {user['username']}（{user['uid']}）设为管理员"
)