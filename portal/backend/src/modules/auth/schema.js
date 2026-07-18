export const loginSchema = {
  email: { required: true },
  password: { required: true }
};

export const changePasswordSchema = {
  currentPassword: { required: true },
  newPassword: { required: true },
  confirmPassword: { required: true }
};
