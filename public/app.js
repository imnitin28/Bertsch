// Shared helpers used by every page.

const TOKEN_KEY = "finance_tracker_token";
const EMAIL_KEY = "finance_tracker_email";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getEmail() {
  return localStorage.getItem(EMAIL_KEY);
}

function setSession(token, email) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

function requireAuthOrRedirect() {
  if (!getToken()) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers, {
    Authorization: `Bearer ${getToken()}`,
  });
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Session expired. Please log in again.");
  }
  return res;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function downloadBase64File(filename, base64Data) {
  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showFlash(container, message, type = "success") {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = `flash flash-${type}`;
  div.textContent = message;
  container.appendChild(div);
}

function setupNav() {
  const emailEl = document.getElementById("nav-user-email");
  if (emailEl) emailEl.textContent = getEmail() || "";

  const specialMsg = document.getElementById("special-message");
  if (specialMsg && getEmail() === "junia1.junia2.junia3@bertsch.com") {  
    specialMsg.textContent = "Junia Bertsch, you look extremely beautiful with middle hair partition";
  }

  const logoutBtn = document.getElementById("nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "/login.html";
    });
  }
}
