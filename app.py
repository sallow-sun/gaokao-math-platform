from functools import wraps
import re
import secrets
import sqlite3
import os
import uuid

from flask import (
    Flask,
    abort,
    flash,
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
app.config["USER_DATABASE"] = "userDatabase.db"
app.config["QUESTION_DATABASE"] = "questionDatabase.db"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

app.url_map.strict_slashes = False


QUESTION_TAG_OPTIONS = [
    "集合",
    "函数",
    "导数",
    "数列",
    "三角函数",
    "平面向量",
    "不等式",
    "立体几何",
    "解析几何",
    "概率统计",
    "排列组合",
    "复数",
    "逻辑与命题",
    "算法与程序框图"
]

ALLOWED_AVATAR_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024

def get_user_db():
    connection = sqlite3.connect(app.config["USER_DATABASE"])
    connection.row_factory = sqlite3.Row
    return connection


def get_question_db():
    connection = sqlite3.connect(app.config["QUESTION_DATABASE"])
    connection.row_factory = sqlite3.Row
    return connection

def init_user_database():
    connection = get_user_db()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            phone TEXT UNIQUE,
            email TEXT NOT NULL UNIQUE,
            avatar TEXT,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_banned INTEGER NOT NULL DEFAULT 0,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    columns = {
        row["name"]
        for row in connection.execute(
            "PRAGMA table_info(users)"
        ).fetchall()
    }

    if "avatar" not in columns:
        connection.execute("""
            ALTER TABLE users
            ADD COLUMN avatar TEXT
        """)

    if "is_admin" not in columns:
        connection.execute("""
            ALTER TABLE users
            ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0
        """)

    if "is_banned" not in columns:
        connection.execute("""
            ALTER TABLE users
            ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0
        """)

    connection.commit()
    connection.close()

def init_question_database():
    connection = get_question_db()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_number TEXT,
            year TEXT,
            region TEXT,
            question_type TEXT,
            difficulty TEXT,
            source TEXT,
            tags TEXT,
            content TEXT NOT NULL,
            solution TEXT,
            answer TEXT,
            creator_uid TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    columns = {
        row["name"]
        for row in connection.execute(
            "PRAGMA table_info(questions)"
        ).fetchall()
    }

    missing_columns = {
        "problem_number": "TEXT",
        "year": "TEXT",
        "region": "TEXT",
        "question_type": "TEXT",
        "difficulty": "TEXT",
        "source": "TEXT",
        "tags": "TEXT",
        "solution": "TEXT",
        "answer": "TEXT",
        "creator_uid": "TEXT",
        "created_at": "TEXT",
        "updated_at": "TEXT"
    }

    for column_name, column_type in missing_columns.items():
        if column_name not in columns:
            connection.execute(
                f"""
                ALTER TABLE questions
                ADD COLUMN {column_name} {column_type}
                """
            )

    if "distiction" in columns:
        connection.execute("""
            UPDATE questions
            SET region = distiction
            WHERE region IS NULL OR region = ''
        """)

    connection.commit()
    connection.close()

def find_user(account):
    connection = get_user_db()

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

def init_user_setting_fields():
    """在已有 users 表中补充头像和签名字段。"""
    connection = get_user_db()

    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(users)").fetchall()
    }

    if "avatar" not in columns:
        connection.execute(
            "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"
        )

    if "signature" not in columns:
        connection.execute(
            "ALTER TABLE users ADD COLUMN signature TEXT DEFAULT ''"
        )

    connection.commit()
    connection.close()


def get_setting_user():
    connection = get_user_db()

    user = connection.execute(
        """
        SELECT
            id,
            uid,
            username,
            email,
            phone,
            avatar,
            signature,
            password_hash
        FROM users
        WHERE id = ?
        """,
        (session["user_id"],)
    ).fetchone()

    connection.close()

    if user is None:
        abort(404)

    return user




@app.route("/")
def index():
    return render_template("index/index.html")

@app.route("/login")
def login_page():
    return render_template("userpage/login.html")


@app.route("/register")
def register_page():
    return render_template("userpage/register.html")


@app.route("/forgot")
def forgot_page():
    return render_template("userpage/forgot.html")





@app.route("/problems")
@login_required
def problems_page():
    keyword = request.args.get(
        "keyword",
        ""
    ).strip()

    year = request.args.get(
        "year",
        ""
    ).strip()

    source = request.args.get(
        "source",
        ""
    ).strip()

    question_type = request.args.get(
        "type",
        ""
    ).strip()

    difficulty = request.args.get(
        "level",
        ""
    ).strip()

    tag = request.args.get(
        "tag",
        ""
    ).strip()

    # 默认按照最早收录排序
    sort = request.args.get(
        "sort",
        "oldest"
    ).strip()

    # 排序规则
    sort_rules = {
        "oldest": """
            ORDER BY created_at ASC, id ASC
        """,

        "newest": """
            ORDER BY created_at DESC, id DESC
        """,

        "number_asc": """
            ORDER BY
                CAST(
                    SUBSTR(problem_number, 2)
                    AS INTEGER
                ) ASC,
                id ASC
        """,

        "number_desc": """
            ORDER BY
                CAST(
                    SUBSTR(problem_number, 2)
                    AS INTEGER
                ) DESC,
                id DESC
        """,

        "easy-first": """
            ORDER BY
                CASE difficulty
                    WHEN '基础' THEN 1
                    WHEN '简单' THEN 1
                    WHEN '典型' THEN 2
                    WHEN '中等' THEN 2
                    WHEN '重点' THEN 3
                    WHEN '挑战' THEN 4
                    WHEN '困难' THEN 4
                    ELSE 5
                END ASC,
                id ASC
        """,

        "hard-first": """
            ORDER BY
                CASE difficulty
                    WHEN '挑战' THEN 1
                    WHEN '困难' THEN 1
                    WHEN '重点' THEN 2
                    WHEN '典型' THEN 3
                    WHEN '中等' THEN 3
                    WHEN '基础' THEN 4
                    WHEN '简单' THEN 4
                    ELSE 5
                END ASC,
                id ASC
        """
    }

    # 如果网址传入了不存在的排序方式，则使用最早收录
    if sort not in sort_rules:
        sort = "oldest"

    order_sql = sort_rules[sort]

    conditions = []
    parameters = []

    # 关键词搜索
    if keyword:
        keyword_value = f"%{keyword}%"

        conditions.append("""
            (
                problem_number LIKE ?
                OR content LIKE ?
                OR tags LIKE ?
                OR source LIKE ?
                OR region LIKE ?
            )
        """)

        parameters.extend([
            keyword_value,
            keyword_value,
            keyword_value,
            keyword_value,
            keyword_value
        ])

    # 年份筛选
    if year:
        conditions.append("year = ?")
        parameters.append(year)

    # 来源筛选
    if source:
        conditions.append("source = ?")
        parameters.append(source)

    # 题目类型筛选
    if question_type:
        conditions.append("question_type = ?")
        parameters.append(question_type)

    # 难度筛选
    if difficulty:
        conditions.append("difficulty = ?")
        parameters.append(difficulty)

    # 标签筛选
    if tag:
        normalized_tag = (
            tag.replace(" ", "")
            .replace("，", ",")
        )

        conditions.append("""
            (
                ',' ||
                REPLACE(
                    REPLACE(
                        COALESCE(tags, ''),
                        '，',
                        ','
                    ),
                    ' ',
                    ''
                )
                || ','
            ) LIKE ?
        """)

        parameters.append(
            f"%,{normalized_tag},%"
        )

    # 拼接 WHERE
    where_sql = ""

    if conditions:
        where_sql = (
            "WHERE "
            + " AND ".join(conditions)
        )

    connection = get_question_db()

    # 查询题目
    rows = connection.execute(
        f"""
        SELECT
            id,
            problem_number,
            year,
            region,
            source,
            question_type,
            difficulty,
            tags,
            content,
            created_at
        FROM questions
        {where_sql}
        {order_sql}
        """,
        parameters
    ).fetchall()

    # 查询所有年份
    years = connection.execute("""
        SELECT DISTINCT year
        FROM questions
        WHERE year IS NOT NULL
          AND year != ''
        ORDER BY year DESC
    """).fetchall()

    # 查询所有来源
    sources = connection.execute("""
        SELECT DISTINCT source
        FROM questions
        WHERE source IS NOT NULL
          AND source != ''
        ORDER BY source ASC
    """).fetchall()

    # 查询所有题目类型
    question_types = connection.execute("""
        SELECT DISTINCT question_type
        FROM questions
        WHERE question_type IS NOT NULL
          AND question_type != ''
        ORDER BY question_type ASC
    """).fetchall()

    connection.close()

    value_colors = {
        "挑战": "red",
        "困难": "red",

        "重点": "yellow",

        "典型": "blue",
        "中等": "blue",

        "基础": "green",
        "简单": "green"
    }

    questions = []

    for row in rows:
        question = dict(row)

        question["value_color"] = value_colors.get(
            question["difficulty"],
            "blue"
        )

        questions.append(question)

    filters = {
        "keyword": keyword,
        "year": year,
        "source": source,
        "type": question_type,
        "level": difficulty,
        "tag": tag,
        "sort": sort
    }

    return render_template(
        "problems/problems.html",
        questions=questions,
        years=years,
        sources=sources,
        question_types=question_types,
        tag_options=QUESTION_TAG_OPTIONS,
        filters=filters,
        sort=sort
    )

@app.route("/user/<int:user_id>")
@login_required
def user_page(user_id):
    connection = get_user_db()

    user = connection.execute(
        """
        SELECT
            id,
            uid,
            username,
            email,
            phone,
            avatar,
            signature,
            created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    if user is None:
        abort(404)

    stats = {
        "completed": 0,
        "uploaded": 0,
        "collected": 0,
        "streak": 0
    }

    return render_template(
        "userpage/user.html",
        user=user,
        stats=stats,
        recent_records=[],
        is_owner=session.get("user_id") == user_id
    )

@app.route("/problems/<problem_number>")
def question_page(problem_number):
    question_connection = get_question_db()

    question = question_connection.execute(
        """
        SELECT *
        FROM questions
        WHERE problem_number = ?
        """,
        (problem_number,)
    ).fetchone()

    if question is None:
        question_connection.close()
        abort(404)

    recommendation = question_connection.execute(
        """
        SELECT problem_number, source, question_type
        FROM questions
        WHERE problem_number != ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (problem_number,)
    ).fetchone()

    question_connection.close()

    # 查询上传者
    creator = None

    if question["creator_uid"]:
        user_connection = get_user_db()

        creator = user_connection.execute(
            """
            SELECT id, uid, username, avatar
            FROM users
            WHERE uid = ?
            """,
            (question["creator_uid"],)
        ).fetchone()

        user_connection.close()

    # 将数据库中的中文题型转换成 CSS 使用的类型
    question_type_styles = {
        "单选": "single",
        "多选": "multiple",
        "填空": "fill",
        "解答": "solution"
    }

    question_type_style = question_type_styles.get(
        question["question_type"],
        "other"
    )

    tags = []

    if question["tags"]:
        tags = [
            tag.strip()
            for tag in question["tags"].replace("，", ",").split(",")
            if tag.strip()
        ]

    return render_template(
        "question/question.html",
        question=question,
        creator=creator,
        recommendation=recommendation,
        question_type_style=question_type_style,
        tags=tags
    )

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

    if user["is_banned"]:
        return jsonify({
            "success": False,
            "message": "该账号已被封禁"
        }), 403

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return jsonify({
        "success": True,
        "message": "登录成功",
        "redirect": url_for("problems_page")
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

    connection = get_user_db()

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

    connection = get_user_db()

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

    return jsonify({
        "success": True,
        "redirect": url_for("login_page")
    })

@app.context_processor
def inject_current_user():
    user_id = session.get("user_id")

    if user_id is None:
        return {
            "current_user": None
        }

    connection = get_user_db()

    current_user = connection.execute(
        """
        SELECT
            id,
            uid,
            username,
            avatar
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    return {
        "current_user": current_user
    }

def admin_required(function):
    @wraps(function)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login_page"))

        connection = get_user_db()

        administrator = connection.execute("""
            SELECT id, is_admin, is_banned
            FROM users
            WHERE id = ?
        """, (session["user_id"],)).fetchone()

        connection.close()

        if (
            administrator is None
            or not administrator["is_admin"]
            or administrator["is_banned"]
        ):
            if request.path.startswith("/api/"):
                return jsonify({
                    "success": False,
                    "message": "你没有管理员权限"
                }), 403

            return "你没有管理员权限", 403

        return function(*args, **kwargs)

    return decorated_function

@app.route("/user/setting", methods=["GET", "POST"])
@login_required
def user_settings_page():
    user = get_setting_user()

    if request.method == "POST":
        signature = request.form.get("signature", "").strip()
        avatar_file = request.files.get("avatar")

        if len(signature) > 40:
            flash("签名不能超过40个字符", "error")
            return redirect(url_for("user_settings_page"))

        if request.content_length and request.content_length > MAX_AVATAR_SIZE:
            flash("头像文件不能超过5MB", "error")
            return redirect(url_for("user_settings_page"))

        avatar_path = user["avatar"] or ""

        if avatar_file and avatar_file.filename:
            extension = (
                avatar_file.filename.rsplit(".", 1)[-1].lower()
                if "." in avatar_file.filename
                else ""
            )

            if extension not in ALLOWED_AVATAR_EXTENSIONS:
                flash("头像只支持 PNG、JPG、JPEG、GIF 或 WEBP", "error")
                return redirect(url_for("user_settings_page"))

            avatar_directory = os.path.join(
                app.static_folder,
                "uploads",
                "avatars"
            )
            os.makedirs(avatar_directory, exist_ok=True)

            avatar_filename = f"{uuid.uuid4().hex}.{extension}"
            avatar_file.save(
                os.path.join(avatar_directory, avatar_filename)
            )

            avatar_path = f"uploads/avatars/{avatar_filename}"

        connection = get_user_db()
        connection.execute(
            """
            UPDATE users
            SET avatar = ?, signature = ?
            WHERE id = ?
            """,
            (avatar_path, signature, session["user_id"])
        )
        connection.commit()
        connection.close()

        flash("个人设置已保存", "success")
        return redirect(url_for("user_settings_page"))

    return render_template(
        "userpage/settings.html",
        user=user,
        active_tab="profile"
    )


@app.route("/user/setting/preference")
@login_required
def user_preference_page():
    return render_template(
        "userpage/settings.html",
        user=get_setting_user(),
        active_tab="preference"
    )


@app.route("/user/setting/security", methods=["GET", "POST"])
@login_required
def user_security_page():
    user = get_setting_user()

    if request.method == "POST":
        action = request.form.get("action", "")
        connection = get_user_db()

        if action == "username":
            username = request.form.get("username", "").strip()

            if not 2 <= len(username) <= 30:
                connection.close()
                flash("用户名长度应为2至30个字符", "error")
                return redirect(url_for("user_security_page"))

            duplicate = connection.execute(
                "SELECT id FROM users WHERE username = ? AND id != ?",
                (username, session["user_id"])
            ).fetchone()

            if duplicate:
                connection.close()
                flash("该用户名已经被使用", "error")
                return redirect(url_for("user_security_page"))

            connection.execute(
                "UPDATE users SET username = ? WHERE id = ?",
                (username, session["user_id"])
            )
            message = "用户名修改成功"

        elif action == "password":
            current_password = request.form.get("current_password", "")
            new_password = request.form.get("new_password", "")
            confirm_password = request.form.get("confirm_password", "")

            if not check_password_hash(
                user["password_hash"],
                current_password
            ):
                connection.close()
                flash("当前密码不正确", "error")
                return redirect(url_for("user_security_page"))

            if len(new_password) < 8:
                connection.close()
                flash("新密码至少需要8个字符", "error")
                return redirect(url_for("user_security_page"))

            if new_password != confirm_password:
                connection.close()
                flash("两次输入的新密码不一致", "error")
                return redirect(url_for("user_security_page"))

            connection.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (
                    generate_password_hash(new_password),
                    session["user_id"]
                )
            )
            message = "密码修改成功"

        elif action == "email":
            email = request.form.get("email", "").strip().lower()

            if email and not re.fullmatch(
                r"[^@\s]+@[^@\s]+\.[^@\s]+",
                email
            ):
                connection.close()
                flash("邮箱格式不正确", "error")
                return redirect(url_for("user_security_page"))

            duplicate = None
            if email:
                duplicate = connection.execute(
                    "SELECT id FROM users WHERE email = ? AND id != ?",
                    (email, session["user_id"])
                ).fetchone()

            if duplicate:
                connection.close()
                flash("该邮箱已经被使用", "error")
                return redirect(url_for("user_security_page"))

            connection.execute(
                "UPDATE users SET email = ? WHERE id = ?",
                (email, session["user_id"])
            )
            message = "邮箱修改成功"

        elif action == "phone":
            phone = request.form.get("phone", "").strip()

            if phone and not re.fullmatch(r"\+?[0-9]{6,20}", phone):
                connection.close()
                flash("手机号格式不正确", "error")
                return redirect(url_for("user_security_page"))

            duplicate = None
            if phone:
                duplicate = connection.execute(
                    "SELECT id FROM users WHERE phone = ? AND id != ?",
                    (phone, session["user_id"])
                ).fetchone()

            if duplicate:
                connection.close()
                flash("该手机号已经被使用", "error")
                return redirect(url_for("user_security_page"))

            connection.execute(
                "UPDATE users SET phone = ? WHERE id = ?",
                (phone, session["user_id"])
            )
            message = "手机号修改成功"

        else:
            connection.close()
            flash("未知的修改操作", "error")
            return redirect(url_for("user_security_page"))

        connection.commit()
        connection.close()
        flash(message, "success")
        return redirect(url_for("user_security_page"))

    return render_template(
        "userpage/settings.html",
        user=user,
        active_tab="security"
    )


def get_question_data():
    data = request.get_json(silent=True) or {}

    fields = [
        "problem_number",
        "year",
        "region",
        "question_type",
        "difficulty",
        "source",
        "tags",
        "content",
        "solution",
        "answer"
    ]

    return {
        field: str(data.get(field, "")).strip()
        for field in fields
    }


@app.route("/admin")
@admin_required
def admin_page():
    connection = get_user_db()

    current_user = connection.execute("""
        SELECT id, uid, username, avatar
        FROM users
        WHERE id = ?
    """, (session["user_id"],)).fetchone()

    connection.close()

    admin_csrf_token = secrets.token_urlsafe(32)
    session["admin_csrf_token"] = admin_csrf_token

    return render_template(
        "admin/admin.html",
        current_user=current_user,
        admin_csrf_token=admin_csrf_token,
        question_tag_options=QUESTION_TAG_OPTIONS
    )


@app.route("/api/admin/users")
@admin_required
def admin_users():
    connection = get_user_db()

    users = connection.execute("""
        SELECT
            id,
            uid,
            username,
            email,
            phone,
            is_admin,
            is_banned,
            created_at
        FROM users
        ORDER BY id DESC
    """).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "users": [dict(user) for user in users]
    })


@app.route(
    "/api/admin/users/<int:user_id>/ban",
    methods=["PATCH"]
)
@admin_required
def admin_ban_user(user_id):
    token = request.headers.get("X-CSRF-Token")

    if token != session.get("admin_csrf_token"):
        return jsonify({
            "success": False,
            "message": "页面凭证已失效，请刷新页面"
        }), 403

    data = request.get_json(silent=True) or {}
    banned = data.get("banned")

    if not isinstance(banned, bool):
        return jsonify({
            "success": False,
            "message": "封禁状态格式错误"
        }), 400

    if user_id == session["user_id"]:
        return jsonify({
            "success": False,
            "message": "不能封禁自己的账号"
        }), 400

    connection = get_user_db()

    target_user = connection.execute("""
        SELECT id, is_admin
        FROM users
        WHERE id = ?
    """, (user_id,)).fetchone()

    if target_user is None:
        connection.close()

        return jsonify({
            "success": False,
            "message": "用户不存在"
        }), 404

    if target_user["is_admin"] and banned:
        connection.close()

        return jsonify({
            "success": False,
            "message": "不能封禁管理员账号"
        }), 400

    connection.execute("""
        UPDATE users
        SET is_banned = ?
        WHERE id = ?
    """, (1 if banned else 0, user_id))

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "用户已封禁" if banned else "用户已解除封禁"
    })


@app.route("/api/admin/questions")
@admin_required
def admin_questions():
    connection = get_question_db()

    questions = connection.execute("""
        SELECT *
        FROM questions
        ORDER BY id DESC
    """).fetchall()

    connection.close()

    return jsonify({
        "success": True,
        "questions": [
            dict(question)
            for question in questions
        ]
    })


@app.route(
    "/api/admin/questions",
    methods=["POST"]
)
@admin_required
def admin_create_question():
    token = request.headers.get("X-CSRF-Token")

    if token != session.get("admin_csrf_token"):
        return jsonify({
            "success": False,
            "message": "页面凭证已失效，请刷新页面"
        }), 403

    data = get_question_data()

    if not data["problem_number"] or not data["content"]:
        return jsonify({
            "success": False,
            "message": "题目编号和题面不能为空"
        }), 400

    user_connection = get_user_db()

    administrator = user_connection.execute("""
        SELECT uid
        FROM users
        WHERE id = ?
    """, (session["user_id"],)).fetchone()

    user_connection.close()

    connection = get_question_db()

    duplicate = connection.execute("""
        SELECT id
        FROM questions
        WHERE problem_number = ?
    """, (data["problem_number"],)).fetchone()

    if duplicate:
        connection.close()

        return jsonify({
            "success": False,
            "message": "该题目编号已经存在"
        }), 409

    connection.execute("""
        INSERT INTO questions (
            problem_number,
            year,
            region,
            question_type,
            difficulty,
            source,
            tags,
            content,
            solution,
            answer,
            creator_uid
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["problem_number"],
        data["year"],
        data["region"],
        data["question_type"],
        data["difficulty"],
        data["source"],
        data["tags"],
        data["content"],
        data["solution"],
        data["answer"],
        administrator["uid"]
    ))

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "题目上传成功"
    }), 201


@app.route(
    "/api/admin/questions/<int:question_id>",
    methods=["PUT"]
)
@admin_required
def admin_update_question(question_id):
    token = request.headers.get("X-CSRF-Token")

    if token != session.get("admin_csrf_token"):
        return jsonify({
            "success": False,
            "message": "页面凭证已失效，请刷新页面"
        }), 403

    data = get_question_data()

    if not data["problem_number"] or not data["content"]:
        return jsonify({
            "success": False,
            "message": "题目编号和题面不能为空"
        }), 400

    connection = get_question_db()

    question = connection.execute("""
        SELECT id
        FROM questions
        WHERE id = ?
    """, (question_id,)).fetchone()

    if question is None:
        connection.close()

        return jsonify({
            "success": False,
            "message": "题目不存在"
        }), 404

    duplicate = connection.execute("""
        SELECT id
        FROM questions
        WHERE problem_number = ?
          AND id != ?
    """, (
        data["problem_number"],
        question_id
    )).fetchone()

    if duplicate:
        connection.close()

        return jsonify({
            "success": False,
            "message": "该题目编号已经存在"
        }), 409

    connection.execute("""
        UPDATE questions
        SET
            problem_number = ?,
            year = ?,
            region = ?,
            question_type = ?,
            difficulty = ?,
            source = ?,
            tags = ?,
            content = ?,
            solution = ?,
            answer = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (
        data["problem_number"],
        data["year"],
        data["region"],
        data["question_type"],
        data["difficulty"],
        data["source"],
        data["tags"],
        data["content"],
        data["solution"],
        data["answer"],
        question_id
    ))

    connection.commit()
    connection.close()

    return jsonify({
        "success": True,
        "message": "题目修改成功"
    })

if __name__ == "__main__":
    init_user_database()
    init_user_setting_fields()
    init_question_database()
    app.run(host="127.0.0.1", port=5000, debug=True)