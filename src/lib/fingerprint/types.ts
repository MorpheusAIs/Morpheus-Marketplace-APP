export interface FingerprintData {
  visitorId: string;
  fingerprintHash: string;
  deviceToken: string;
  components: Record<string, unknown>;
}

export interface RegistrationCheckRequest {
  fingerprint_hash: string;
  device_token: string | null;
  ip_address: string;
  ip_subnet: string;
  email: string;
}

export interface RegistrationCheckResponse {
  allowed: boolean;
  reason: string | null;
  fingerprint_count: number;
  ip_count: number;
  device_token_count: number;
}
