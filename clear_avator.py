import sqlite3

connection = sqlite3.connect("userDatabase.db")

connection.execute(
    """
    UPDATE users
    SET avatar = ''
    WHERE uid = ?
    """,
    ("UID00000001",)
)

connection.commit()
connection.close()

print("头像已经清空")