document.addEventListener("DOMContentLoaded", () => {
    const csrfToken = document
        .querySelector('meta[name="admin-csrf-token"]')
        .content;

    const state = {
        users: [],
        questions: []
    };

    const SOURCE_NAMES = {
        "national-new-1": "新高考Ⅰ卷",
        "national-new-2": "新高考Ⅱ卷",
        "national-a": "全国甲卷",
        "local": "地方题",
        "mock": "模拟题"
    };

    const TYPE_NAMES = {
        "single-choice": "单项选择题",
        "multiple-choice": "多项选择题",
        "fill-blank": "填空题",
        "solution": "解答题"
    };

    function getSourceName(value) {
        return SOURCE_NAMES[value] || value || "来源未设置";
    }

    function getTypeName(value) {
        return TYPE_NAMES[value] || value || "题型未设置";
    }

    const usersBody = document.querySelector("#users-body");
    const questionsList = document.querySelector("#questions-list");
    const userSearch = document.querySelector("#user-search");
    const questionSearch = document.querySelector("#question-search");
    const questionForm = document.querySelector("#question-form");
    const questionId = document.querySelector("#question-id");
    const formTitle = document.querySelector("#form-title");
    const cancelEdit = document.querySelector("#cancel-edit");
    const submitButton = document.querySelector("#question-submit");
    const feedback = document.querySelector("#question-feedback");
    const questionImage = document.querySelector("#question-image");
    const questionImagePath = document.querySelector("#question-image-path");
    const questionImagePreview = document.querySelector("#question-image-preview");
    const questionImagePreviewElement = questionImagePreview.querySelector("img");
    const removeQuestionImage = document.querySelector("#remove-question-image");

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function requestJson(url, options = {}) {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        if (options.method && options.method !== "GET") {
            if (!(options.body instanceof FormData)) {
                headers["Content-Type"] = "application/json";
            }
            headers["X-CSRF-Token"] = csrfToken;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "操作失败"
            );
        }

        return result;
    }

    function typesetMath(container) {
        if (!window.MathJax || !MathJax.startup || !MathJax.typesetPromise) {
            return;
        }

        MathJax.startup.promise.then(() => {
            MathJax.typesetClear([container]);
            return MathJax.typesetPromise(container.querySelectorAll(".math-content"));
        }).catch(() => {});
    }

    function showQuestionImage(source) {
        questionImagePreviewElement.src = source;
        questionImagePreview.hidden = !source;
    }

    function updateStatistics() {
        const banned = state.users.filter(
            user => Boolean(user.is_banned)
        ).length;

        document.querySelector(
            "#user-total"
        ).textContent = state.users.length;

        document.querySelector(
            "#active-total"
        ).textContent =
            state.users.length - banned;

        document.querySelector(
            "#banned-total"
        ).textContent = banned;

        document.querySelector(
            "#question-total"
        ).textContent = state.questions.length;
    }

    function renderUsers() {
        const keyword = userSearch.value
            .trim()
            .toLowerCase();

        const users = state.users.filter(user => {
            return [
                user.id,
                user.uid,
                user.username,
                user.email
            ]
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });

        if (!users.length) {
            usersBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">
                        没有符合条件的用户
                    </td>
                </tr>
            `;

            return;
        }

        usersBody.innerHTML = users.map(user => {
            const isAdmin = Boolean(
                user.is_admin
            );

            const isBanned = Boolean(
                user.is_banned
            );

            let status = "正常";
            let statusClass = "";

            if (isAdmin) {
                status = "管理员";
                statusClass = "admin";
            } else if (isBanned) {
                status = "已封禁";
                statusClass = "banned";
            }

            return `
                <tr>
                    <td>
                        #${escapeHtml(user.id)}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                user.username
                            )}
                        </strong>
                        <br>

                        <small>
                            ${escapeHtml(
                                user.uid
                            )}
                        </small>
                    </td>

                    <td>
                        ${escapeHtml(
                            user.email
                        )}
                        <br>

                        <small>
                            ${escapeHtml(
                                user.phone ||
                                "未绑定手机号"
                            )}
                        </small>
                    </td>

                    <td>
                        ${escapeHtml(
                            user.created_at ||
                            "—"
                        )}
                    </td>

                    <td>
                        <span
                            class="status ${statusClass}"
                        >
                            ${status}
                        </span>
                    </td>

                    <td>
                        <button
                            class="
                                action-button
                                ${
                                    isBanned
                                        ? ""
                                        : "danger"
                                }
                            "
                            data-user-id="${user.id}"
                            data-banned="${String(
                                !isBanned
                            )}"
                            ${
                                isAdmin
                                    ? "disabled"
                                    : ""
                            }
                        >
                            ${
                                isBanned
                                    ? "解除封禁"
                                    : "封禁"
                            }
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function loadUsers() {
        const result = await requestJson(
            "/api/admin/users"
        );

        state.users = result.users;

        renderUsers();
        updateStatistics();
    }

    function renderQuestions() {
        const keyword = questionSearch.value
            .trim()
            .toLowerCase();

        const questions = state.questions.filter(
            question => {
                return [
                    question.problem_number,
                    question.source,
                    getSourceName(
                        question.source
                    ),
                    question.region,
                    question.question_type,
                    getTypeName(
                        question.question_type
                    ),
                    question.difficulty,
                    String(
                        question.difficulty || ""
                    ).toUpperCase(),
                    question.tags
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword);
            }
        );

        if (!questions.length) {
            questionsList.innerHTML = `
                <p class="empty">
                    没有符合条件的题目
                </p>
            `;

            return;
        }

        questionsList.innerHTML =
            questions.map(question => `
                <article class="question-item">

                    <div class="question-item-header">

                        <div>
                            <h3>
                                ${escapeHtml(
                                    question.problem_number ||
                                    `#${question.id}`
                                )}
                            </h3>

                            <p class="meta">
                                ${escapeHtml(
                                    question.year ||
                                    "年份未设置"
                                )}
                                ·

                                ${escapeHtml(
                                    getSourceName(
                                        question.source
                                    )
                                )}
                                ·

                                ${escapeHtml(
                                    question.region ||
                                    "地区未设置"
                                )}
                                ·

                                ${escapeHtml(
                                    getTypeName(
                                        question.question_type
                                    )
                                )}
                                ·

                                ${escapeHtml(
                                    String(
                                        question.difficulty ||
                                        "white"
                                    ).toUpperCase()
                                )}
                            </p>
                        </div>

                        <button
                            class="edit-button"
                            data-question-id="${question.id}"
                        >
                            编辑
                        </button>
                    </div>

                    <div class="content math-content">
                        ${escapeHtml(
                            question.content
                        )}
                    </div>
                    ${question.image_path ? `
                        <img class="admin-question-image"
                            src="/static/${escapeHtml(question.image_path)}"
                            alt="${escapeHtml(question.problem_number)}题目配图">
                    ` : ""}

                </article>
            `).join("");

        typesetMath(questionsList);
    }

    async function loadQuestions() {
        const result = await requestJson(
            "/api/admin/questions"
        );

        state.questions = result.questions;

        renderQuestions();
        updateStatistics();
    }

    function resetForm() {
        questionForm.reset();

        questionId.value = "";
        questionImagePath.value = "";
        questionImage.value = "";
        showQuestionImage("");

        formTitle.textContent =
            "上传题目";

        submitButton.textContent =
            "上传题目";

        cancelEdit.hidden = true;

        feedback.textContent = "";
    }

    function editQuestion(id) {
        const question = state.questions.find(
            item => item.id === Number(id)
        );

        if (!question) {
            return;
        }

        questionId.value = question.id;
        questionImagePath.value = question.image_path || "";
        questionImage.value = "";
        showQuestionImage(
            question.image_path ? `/static/${question.image_path}` : ""
        );

        const fields = [
            "problem_number",
            "year",
            "region",
            "source",
            "question_type",
            "difficulty",
            "content",
            "solution",
            "answer"
        ];

        fields.forEach(fieldName => {
            const field =
                questionForm.elements[
                    fieldName
                ];

            if (field) {
                field.value =
                    question[fieldName] ||
                    "";
            }
        });

        const selectedTags = new Set(
            String(
                question.tags || ""
            )
                .replaceAll("，", ",")
                .split(",")
                .map(tag =>
                    tag.trim()
                )
                .filter(Boolean)
        );

        questionForm
            .querySelectorAll(
                'input[name="tags"]'
            )
            .forEach(checkbox => {
                checkbox.checked =
                    selectedTags.has(
                        checkbox.value
                    );
            });

        formTitle.textContent =
            `编辑 ${question.problem_number}`;

        submitButton.textContent =
            "保存修改";

        cancelEdit.hidden = false;

        questionForm.scrollIntoView({
            behavior: "smooth"
        });
    }

    document
        .querySelectorAll(
            ".admin-tab"
        )
        .forEach(tab => {
            tab.addEventListener(
                "click",
                () => {
                    document
                        .querySelectorAll(
                            ".admin-tab"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );

                    tab.classList.add(
                        "active"
                    );

                    document.querySelector(
                        "#users-panel"
                    ).hidden =
                        tab.dataset.target !==
                        "users-panel";

                    document.querySelector(
                        "#questions-panel"
                    ).hidden =
                        tab.dataset.target !==
                        "questions-panel";
                }
            );
        });

    userSearch.addEventListener(
        "input",
        renderUsers
    );

    questionSearch.addEventListener(
        "input",
        renderQuestions
    );

    usersBody.addEventListener(
        "click",
        async event => {
            const button =
                event.target.closest(
                    "[data-user-id]"
                );

            if (!button) {
                return;
            }

            const userId =
                button.dataset.userId;

            const banned =
                button.dataset.banned ===
                "true";

            if (
                !confirm(
                    banned
                        ? "确定封禁这个用户吗？"
                        : "确定解除封禁吗？"
                )
            ) {
                return;
            }

            button.disabled = true;

            try {
                const result =
                    await requestJson(
                        `/api/admin/users/${userId}/ban`,
                        {
                            method: "PATCH",

                            body:
                                JSON.stringify({
                                    banned
                                })
                        }
                    );

                alert(result.message);

                await loadUsers();
            } catch (error) {
                alert(error.message);

                button.disabled = false;
            }
        }
    );

    questionsList.addEventListener(
        "click",
        event => {
            const button =
                event.target.closest(
                    "[data-question-id]"
                );

            if (button) {
                editQuestion(
                    button.dataset.questionId
                );
            }
        }
    );

    cancelEdit.addEventListener(
        "click",
        resetForm
    );

    questionImage.addEventListener("change", () => {
        const file = questionImage.files[0];

        if (!file) {
            showQuestionImage(
                questionImagePath.value ? `/static/${questionImagePath.value}` : ""
            );
            return;
        }

        showQuestionImage(URL.createObjectURL(file));
    });

    removeQuestionImage.addEventListener("click", () => {
        questionImage.value = "";
        questionImagePath.value = "";
        showQuestionImage("");
    });

    questionForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const formData =
                new FormData(
                    questionForm
                );

            const data =
                Object.fromEntries(
                    formData.entries()
                );

            data.tags = formData
                .getAll("tags")
                .join(",");

            const id =
                questionId.value;

            const editing =
                Boolean(id);

            submitButton.disabled = true;

            feedback.textContent =
                editing
                    ? "正在保存……"
                    : "正在上传……";

            try {
                const selectedImage = questionImage.files[0];

                if (selectedImage) {
                    const imageData = new FormData();
                    imageData.append("image", selectedImage);
                    const uploadResult = await requestJson(
                        "/api/admin/question-images",
                        { method: "POST", body: imageData }
                    );
                    data.image_path = uploadResult.image_path;
                } else {
                    data.image_path = questionImagePath.value;
                }

                const result =
                    await requestJson(
                        editing
                            ? `/api/admin/questions/${id}`
                            : "/api/admin/questions",
                        {
                            method:
                                editing
                                    ? "PUT"
                                    : "POST",

                            body:
                                JSON.stringify(
                                    data
                                )
                        }
                    );

                feedback.textContent =
                    result.message;

                resetForm();

                await loadQuestions();
            } catch (error) {
                feedback.textContent =
                    error.message;
            } finally {
                submitButton.disabled =
                    false;
            }
        }
    );

    Promise.all([
        loadUsers(),
        loadQuestions()
    ]).catch(error => {
        alert(error.message);
    });
});
