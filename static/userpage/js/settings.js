const avatarInput = document.getElementById("avatar-input");
const avatarPreview = document.getElementById("avatar-preview");
const avatarFallback = document.getElementById(
  "avatar-preview-fallback"
);
const avatarFileName = document.getElementById(
  "avatar-file-name"
);

const signatureInput = document.getElementById("signature");
const signatureCount = document.getElementById(
  "signature-count"
);

if (
  avatarInput &&
  avatarPreview &&
  avatarFallback &&
  avatarFileName
) {
  avatarInput.addEventListener("change", function () {
    const file = avatarInput.files[0];

    if (!file) {
      avatarFileName.textContent = "尚未选择新头像";
      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      avatarInput.value = "";
      avatarFileName.textContent =
        "只支持 PNG、JPG、GIF 或 WEBP 图片";
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      avatarInput.value = "";
      avatarFileName.textContent =
        "头像文件不能超过 5MB";
      return;
    }

    avatarFileName.textContent = file.name;

    const reader = new FileReader();

    reader.addEventListener("load", function () {
      avatarPreview.src = reader.result;
      avatarPreview.hidden = false;
      avatarFallback.hidden = true;
    });

    reader.readAsDataURL(file);
  });
}

if (signatureInput && signatureCount) {
  function updateSignatureCount() {
    signatureCount.textContent =
      signatureInput.value.length;
  }

  signatureInput.addEventListener(
    "input",
    updateSignatureCount
  );

  updateSignatureCount();
}