import { apiPost } from '../../shared/api-client.js';
import { fetchCsrfToken } from '../../shared/csrf-client.js';

export function renderLogin(onAuthenticated) {
  const section = document.createElement('section');
  section.dataset.feature = 'auth';
  section.className = 'auth-page';
  section.innerHTML = `
    <div class="mobile-policy" role="note">
      Cổng nội bộ hiện chỉ hỗ trợ thiết bị desktop. Backend vẫn là lớp quyết định truy cập cuối cùng.
    </div>
    <form class="auth-card" aria-labelledby="login-title">
      <p class="eyebrow">Internal Portal</p>
      <h1 id="login-title">IDS-HRM-GIS</h1>
      <label>
        <span>Email</span>
        <input name="email" type="email" autocomplete="username" required>
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <p class="form-error" role="alert" hidden>Unable to sign in. Check your credentials and device access.</p>
      <button type="submit">Sign in</button>
    </form>
  `;

  const form = section.querySelector('form');
  const button = section.querySelector('button');
  const error = section.querySelector('.form-error');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'Signing in...';

    try {
      const csrfToken = await fetchCsrfToken();
      const data = new FormData(form);
      await apiPost('/api/auth/login', {
        email: data.get('email'),
        password: data.get('password')
      }, csrfToken);
      await onAuthenticated();
    } catch {
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  return section;
}
