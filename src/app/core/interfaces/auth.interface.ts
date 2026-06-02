import { Role } from '@core/interfaces/enums';

export interface IUserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: IUserSummary;
}

export interface ISignUpRequest {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
}

export interface ISignInRequest {
  email: string;
  password: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}

export interface IUpdateProfileRequest {
  name: string;
  avatarUrl?: string | null;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
