const formMsg = document.getElementById('formMsg');
const captchaImg = document.getElementById('captchaImg');
const submitBtn = document.getElementById('submitBtn');

function showFormMsg(text, kind) {
  formMsg.textContent = text;
  formMsg.className = `form-msg show ${kind}`;
}
function clearFormMsg() {
  formMsg.className = 'form-msg';
}

async function loadCaptcha() {
  try {
    const res = await fetch('/api/captcha');
    const data = await res.json();
    captchaImg.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(data.svg);
  } catch {
    showFormMsg('Could not load captcha — check your connection and refresh.', 'error');
  }
}
loadCaptcha();
document.getElementById('captchaRefresh').addEventListener('click', loadCaptcha);
captchaImg.addEventListener('click', loadCaptcha);

document.getElementById('toggleVis').addEventListener('click', (e) => {
  const input = document.getElementById('password');
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  e.target.textContent = isPw ? 'HIDE' : 'SHOW';
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormMsg();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying…';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const captchaAnswer = document.getElementById('captchaInput').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, captchaAnswer }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sign in failed.');
    location.href = '/dashboard.html';
  } catch (err) {
    showFormMsg(err.message, 'error');
    document.getElementById('captchaInput').value = '';
    loadCaptcha();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
});

document.getElementById('googleBtn').addEventListener('click', async () => {
  const btn = document.getElementById('googleBtn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/auth/google', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');
    location.href = '/dashboard.html';
  } catch (err) {
    showFormMsg(err.message, 'error');
    btn.disabled = false;
  }
});

// ---- forgot password modal ----
const forgotModal = document.getElementById('forgotModal');
const forgotMsg = document.getElementById('forgotMsg');
document.getElementById('forgotBtn').addEventListener('click', () => {
  forgotMsg.className = 'form-msg';
  forgotModal.classList.add('show');
});
document.getElementById('forgotCancel').addEventListener('click', () => forgotModal.classList.remove('show'));
forgotModal.addEventListener('click', (e) => { if (e.target === forgotModal) forgotModal.classList.remove('show'); });

document.getElementById('forgotSubmit').addEventListener('click', async () => {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) {
    forgotMsg.textContent = 'Enter an email address.';
    forgotMsg.className = 'form-msg show error';
    return;
  }
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    let text = data.message || 'If that email exists, a reset link has been sent.';
    if (data.demoResetLink) {
      text += ` Demo link: ${location.origin}${data.demoResetLink}`;
    }
    forgotMsg.textContent = text;
    forgotMsg.className = 'form-msg show success';
  } catch {
    forgotMsg.textContent = 'Something went wrong. Try again.';
    forgotMsg.className = 'form-msg show error';
  }
});

// ---- register modal ----
const registerModal = document.getElementById('registerModal');
const registerMsg = document.getElementById('registerMsg');
document.getElementById('showRegister').addEventListener('click', (e) => {
  e.preventDefault();
  registerMsg.className = 'form-msg';
  registerModal.classList.add('show');
});
document.getElementById('registerCancel').addEventListener('click', () => registerModal.classList.remove('show'));
registerModal.addEventListener('click', (e) => { if (e.target === registerModal) registerModal.classList.remove('show'); });

document.getElementById('registerSubmit').addEventListener('click', async () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!email || password.length < 6) {
    registerMsg.textContent = 'Enter a valid email and a password of at least 6 characters.';
    registerMsg.className = 'form-msg show error';
    return;
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create account.');
    registerMsg.textContent = 'Account created — you can sign in now.';
    registerMsg.className = 'form-msg show success';
    document.getElementById('email').value = email;
    setTimeout(() => registerModal.classList.remove('show'), 1200);
  } catch (err) {
    registerMsg.textContent = err.message;
    registerMsg.className = 'form-msg show error';
  }
});
