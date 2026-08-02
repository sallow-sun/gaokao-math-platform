from functools import wraps
import re
import secrets
import sqlite3

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for
)
from werkzeug.security import check_password_hash, generate_password_hash


app = Flask(__name__)

app.config["SECRET_KEY"] = secrets.token_hex(32)
app.config["DATABASE"] = "database.db"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def get_db():
    connection = sqlite3.connect(app.config["DATABASE"])
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    connection = get_db()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            phone TEXT UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()


def find_user(account):
    connection = get_db()

    user = connection.execute("""
        SELECT *
        FROM users
        WHERE username = ?
           OR uid = ?
           OR phone = ?
           OR email = ?
        LIMIT 1
    """, (account, account, account, account)).fetchone()

    connection.close()
    return user


def login_required(function):
    @wraps(function)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login_page"))

        return function(*args, **kwargs)

    return decorated_function


def valid_email(email):
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    return re.match(pattern, email) is not None


def valid_phone(phone):
    if not phone:
        return True

    pattern = r"^1[3-9]\d{9}$"
    return re.match(pattern, phone) is not None


@app.route("/")
@login_required
def index():
    return render_template("index.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/register")
def register_page():
    return render_template("register.html")

@app.route("/forgot")
def forgot_page():
    return render_template("forgot.html")


@app.route("/api/check-account", methods=["POST"])
def check_account():
    data = request.get_json(silent=True) or {}
    account = str(data.get("account", "")).strip()

    if not account:
        return jsonify({
            "success": False,
            "message": "请输入登录账号"
        }), 400

    user = find_user(account)

    if user is None:
        return jsonify({
            "success": False,
            "message": "账号不存在"
        }), 404

    return jsonify({
        "success": True,
        "message": "账号存在，请输入密码"
    })


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    account = str(data.get("account", "")).strip()
    password = str(data.get("password", ""))

    if not account or not password:
        return jsonify({
            "success": False,
            "message": "账号和密码不能为空"
        }), 400

    user = find_user(account)

    if user is None or not check_password_hash(
        user["password_hash"],
        password
    ):
        return jsonify({
            "success": False,
            "message": "账号或密码错误"
        }), 401

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]

    return jsonify({
        "success": True,
        "message": "登录成功",
        "redirect": url_for("index")
    })


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    phone = str(data.get("phone", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirmPassword", ""))

    if not username or not email or not password:
        return jsonify({
            "success": False,
            "message": "用户名、邮箱和密码不能为空"
        }), 400

    if len(username) < 2 or len(username) > 20:
        return jsonify({
            "success": False,
            "message": "用户名长度必须为2到20个字符"
        }), 400

    if not valid_email(email):
        return jsonify({
            "success": False,
            "message": "邮箱格式不正确"
        }), 400

    if not valid_phone(phone):
        return jsonify({
            "success": False,
            "message": "手机号码格式不正确"
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "密码长度不能少于6位"
        }), 400

    if password != confirm_password:
        return jsonify({
            "success": False,
            "message": "两次输入的密码不一致"
        }), 400

    connection = get_db()

    username_exists = connection.execute("""
        SELECT id
        FROM users
        WHERE username = ?
    """, (username,)).fetchone()

    if username_exists:
        connection.close()

        return jsonify({
            "success": False,
            "message": "该用户名已被使用"
        }), 409

    email_exists = connection.execute("""
        SELECT id
        FROM users
        WHERE email = ?
    """, (email,)).fetchone()

    if email_exists:
        connection.close()

        return jsonify({
            "success": False,
            "message": "该邮箱已被注册"
        }), 409

    if phone:
        phone_exists = connection.execute("""
            SELECT id
            FROM users
            WHERE phone = ?
        """, (phone,)).fetchone()

        if phone_exists:
            connection.close()

            return jsonify({
                "success": False,
                "message": "该手机号码已被注册"
            }), 409

    cursor = connection.execute("""
        INSERT INTO users (
            uid,
            username,
            phone,
            email,
            password_hash
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        "TEMP",
        username,
        phone if phone else None,
        email,
        generate_password_hash(password)
    ))

    user_id = cursor.lastrowid
    uid = f"UID{user_id:08d}"

    connection.execute("""
        UPDATE users
        SET uid = ?
        WHERE id = ?
    """, (uid, user_id))

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "注册成功",
        "uid": uid,
        "redirect": url_for("userMainpage")
    }), 201


@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}

    account = str(data.get("account", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    new_password = str(data.get("newPassword", ""))
    confirm_password = str(data.get("confirmPassword", ""))

    if not account or not email or not new_password:
        return jsonify({
            "success": False,
            "message": "请填写完整信息"
        }), 400

    if len(new_password) < 6:
        return jsonify({
            "success": False,
            "message": "新密码长度不能少于6位"
        }), 400

    if new_password != confirm_password:
        return jsonify({
            "success": False,
            "message": "两次输入的密码不一致"
        }), 400

    connection = get_db()

    user = connection.execute("""
        SELECT id
        FROM users
        WHERE (
            username = ?
            OR uid = ?
            OR phone = ?
        )
        AND email = ?
        LIMIT 1
    """, (account, account, account, email)).fetchone()

    if user is None:
        connection.close()

        return jsonify({
            "success": False,
            "message": "账号与邮箱不匹配"
        }), 404

    connection.execute("""
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
    """, (
        generate_password_hash(new_password),
        user["id"]
    ))

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "密码修改成功",
        "redirect": url_for("login_page")
    })


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]

    return jsonify({
        "success": True,
        "redirect": url_for("login_page")
    })


if __name__ == "__main__":
    init_database()
    app.run(host="127.0.0.1", port=5000, debug=True)