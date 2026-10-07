export interface UserSession {
  token: string;
  userId: string;
  username: string;
  role: 'admin' | 'seller';
}

export interface ISessionRepository {
  getSession(): UserSession | null;
  setSession(session: UserSession): void;
  clearSession(): void;
}