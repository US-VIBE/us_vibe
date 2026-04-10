export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
};
