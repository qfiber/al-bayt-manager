import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const APP_NAME = 'Al-Bayt Manager';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

export function getTotpUri(secret: string, email: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

export async function generateQrCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}
