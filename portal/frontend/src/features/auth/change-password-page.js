import { apiPost } from '../../shared/api-client.js';
import { fetchCsrfToken, getCsrfToken } from '../../shared/csrf-client.js';

export function renderChangePassword(onChanged) {
  const section = document.createElement('section');
  section.className = 'auth-page';
  section.innerHTML = `
    <form class="auth-card" aria-describedby="change-password-message">
      <p class="eyebrow">Password required</p>
      <h1>Change password</h1>
      <p>Your account requires a new password before entering the portal.</p>
      <label>
        Current password
        <input name="currentPassword" type="password" autocomplete="current-password" required>
      </label>
      <label>
        New password
        <input name="newPassword" type="password" autocomplete="new-password" minlength="12" required>
      </label>
      <label>
        Confirm new password
        <input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required>
      </label>
      <p id="change-password-message" class="form-message" aria-live="polite"></p>
      <button type="submit">Update password</button>
    </form>
  `;

  const form = section.querySelector('form');
  const message = section.querySelector('.form-message');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const formData = new FormData(form);
    button.disabled = true;
    message.textContent = '';
    try {
      const csrfToken = getCsrfToken() || await fetchCsrfToken();
      await apiPost('/api/auth/change-password', {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword')
      }, csrfToken);
      form.reset();
      message.textContent = 'Password changed successfully.';
      await onChanged();
    } catch {
      message.textContent = 'Unable to change password. Check the current password and requirements.';
    } finally {
      button.disabled = false;
    }
  });
  return section;
}
