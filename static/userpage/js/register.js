const registerForm = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("message");
const agreeTerms = document.getElementById("agreeTerms");

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
}

function setLoading(loading) {
    registerButton.disabled = loading;
    registerButton.textContent = loading
        ? "正在创建"
        : "创建账号";
}

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document
        .getElementById("username")
        .value
        .trim();

    const phone = document
        .getElementById("phone")
        .value
        .trim();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    const confirmPassword = document
        .getElementById("confirmPassword")
        .value;

    if (!username || !email || !password) {
        showMessage("用户名、邮箱和密码不能为空");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("两次输入的密码不一致");
        return;
    }
    
    if (!agreeTerms.checked) {
        showMessage("请先阅读并同意用户协议");
        return;
    }

    setLoading(true);

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                phone,
                email,
                password,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "注册失败");
            return;
        }

        showMessage(
            `注册成功，你的UID是：${result.uid}`,
            "success"
        );

        setTimeout(function () {
            window.location.href = result.redirect;
        }, 1800);
    } catch (error) {
        showMessage("无法连接服务器，请稍后重试");
    } finally {
        setLoading(false);
    }
});

agreeTerms.addEventListener("change", function () {
    registerButton.disabled = !agreeTerms.checked;
});