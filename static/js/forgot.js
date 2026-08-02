const forgotForm = document.getElementById("forgotForm");
const resetButton = document.getElementById("resetButton");
const message = document.getElementById("message");

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
}

function setLoading(loading) {
    resetButton.disabled = loading;
    resetButton.textContent = loading
        ? "正在修改"
        : "修改密码";
}

forgotForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const account = document
        .getElementById("account")
        .value
        .trim();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const newPassword = document
        .getElementById("newPassword")
        .value;

    const confirmPassword = document
        .getElementById("confirmPassword")
        .value;

    if (!account || !email || !newPassword) {
        showMessage("请填写完整信息");
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage("两次输入的密码不一致");
        return;
    }

    setLoading(true);

    try {
        const response = await fetch("/api/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                account,
                email,
                newPassword,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "密码修改失败");
            return;
        }

        showMessage("密码修改成功，正在返回登录页", "success");

        setTimeout(function () {
            window.location.href = result.redirect;
        }, 1500);
    } catch (error) {
        showMessage("无法连接服务器，请稍后重试");
    } finally {
        setLoading(false);
    }
});