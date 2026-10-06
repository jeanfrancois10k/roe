import { Role, VendorStatus, DeviceStatus } from './enums';

export interface UserPayload {
  id: string;
  username: string;
  email?: string | null;
  role: Role;
  vendorId?: string;
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VendorProfileSummary {
  id: string;
  vendorCode: string;
  fullName: string;
  phone: string;
  posAddress: string;
  status: VendorStatus;
  currentBalance: number;
  creditLimit: number;
  dailySalesLimit: number;
  maxTicketAmount: number;
  defaultCommissionRate: number;
  isOnline: boolean;
  lastLoginAt: Date | null;
}

export interface DeviceInfo {
  deviceUuid: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  status: DeviceStatus;
}
