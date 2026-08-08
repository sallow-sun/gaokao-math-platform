document.addEventListener("DOMContentLoaded", () => {
  const logoutButton = document.querySelector("#logout-button");
  const logoutFeedback = document.querySelector("#logout-feedback");

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "正在退出...";
    logoutFeedback.textContent = "";

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: {
          Accept: "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "退出失败，请稍后重试");
      }

      window.location.href = result.redirect || "/login";
    } catch (error) {
      logoutFeedback.textContent = error.message;
      logoutButton.disabled = false;
      logoutButton.textContent = "退出登录";
    }
  });
});
