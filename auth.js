const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');
const sessionKey = 'master-motors-session';
function setLoggedIn(loggedIn) {
  document.querySelector('#loginScreen').hidden = loggedIn;
  document.querySelector('#workspace').hidden = !loggedIn;
  document.body.classList.toggle('locked', !loggedIn);
  document.title = loggedIn ? 'Master Motors | Car Service Workspace' : 'Sign in | Master Motors';
}
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const username = loginForm.elements.username.value.trim();
  const password = loginForm.elements.password.value;
  if (username === 'ADMIN' && password === '112233') {
    sessionStorage.setItem(sessionKey, 'signed-in');
    loginError.textContent = '';
    loginForm.reset();
    document.querySelector('#password').type = 'password';
    document.querySelector('#togglePassword').textContent = 'Show';
    document.querySelector('#togglePassword').setAttribute('aria-label', 'Show password');
    document.querySelector('#togglePassword').setAttribute('aria-pressed', 'false');
    setLoggedIn(true);
    document.querySelector('#nav button').focus();
  } else {
    loginError.textContent = 'Incorrect username or password. Please try again.';
    loginForm.elements.password.value = '';
    loginForm.elements.password.focus();
  }
});
document.querySelector('#togglePassword').addEventListener('click', event => {
  const password = document.querySelector('#password');
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  event.currentTarget.setAttribute('aria-pressed', String(show));
});
function logout() {
  sessionStorage.removeItem(sessionKey);
  document.querySelector('#modal').close();
  loginForm.reset();
  loginError.textContent = '';
  setLoggedIn(false);
  document.querySelector('#username').focus();
}
setLoggedIn(sessionStorage.getItem(sessionKey) === 'signed-in');
