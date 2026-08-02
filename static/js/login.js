const loginForm = document.getElementById("loginForm");
const accountInput = document.getElementById("account");
const passwordInput = document.getElementById("password");
const passwordGroup = document.getElementById("passwordGroup");
const nextButton = document.getElementById("nextButton");
const message = document.getElementById("message");
const togglePassword = document.getElementById("togglePassword");
const cardTitle = document.getElementById("cardTitle");
const loginContent = document.getElementById("loginContent");
const loginSuccess = document.getElementById("loginSuccess");

let currentStep = 1;
let checkedAccount = "";

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
}

function clearMessage() {
    message.textContent = "";
    message.className = "message";
}

function setLoading(loading, text) {
    nextButton.disabled = loading;

    if (loading) {
        nextButton.textContent = text;
    } else {
        nextButton.textContent =
            currentStep === 1 ? "下一步" : "登录";
    }
}

async function checkAccount() {
    const account = accountInput.value.trim();

    if (!account) {
        showMessage("请输入登录账号");
        accountInput.focus();
        return;
    }

    clearMessage();
    setLoading(true, "正在检查");

    try {
        const response = await fetch("/api/check-account", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                account: account
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "账号检查失败");
            return;
        }

        checkedAccount = account;
        currentStep = 2;

        accountInput.readOnly = true;
        passwordGroup.classList.remove("hidden");
        nextButton.textContent = "登录";

        passwordInput.focus();
    } catch (error) {
        showMessage("无法连接服务器，请稍后重试");
    } finally {
        setLoading(false);
    }
}

async function submitLogin() {
    const password = passwordInput.value;

    if (!password) {
        showMessage("请输入登录密码");
        passwordInput.focus();
        return;
    }

    clearMessage();
    setLoading(true, "正在登录");

    let loginSucceeded = false;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                account: checkedAccount,
                password: password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "登录失败");
            return;
        }

        loginSucceeded = true;

        clearMessage();
        loginContent.classList.add("hidden");
        loginSuccess.classList.remove("hidden");
        cardTitle.textContent = "";

        setTimeout(function () {
            window.location.href = result.redirect;
        }, 2000);

    } catch (error) {
        showMessage("无法连接服务器，请稍后重试");
    } finally {
        if (!loginSucceeded) {
            setLoading(false);
        }
    }
}

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (currentStep === 1) {
        checkAccount();
    } else {
        submitLogin();
    }
});

accountInput.addEventListener("input", function () {
    if (currentStep !== 2) {
        return;
    }

    currentStep = 1;
    checkedAccount = "";

    accountInput.readOnly = false;
    passwordInput.value = "";
    passwordGroup.classList.add("hidden");
    nextButton.textContent = "下一步";

    clearMessage();
});

togglePassword.addEventListener("click", function () {
    const passwordVisible = passwordInput.type === "text";

    passwordInput.type = passwordVisible
        ? "password"
        : "text";

    togglePassword.textContent = passwordVisible
        ? "显示"
        : "隐藏";
});