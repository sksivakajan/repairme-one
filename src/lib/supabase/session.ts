import { createHash, randomBytes } from 'node:crypto';
// Cookie that marks a browser where the authenticator was verified and "remember this device" was chosen.
export const TRUST_COOKIE = 'repairme_trusted';
export const TRUST_DAYS = 30;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newTrustToken = () => randomBytes(32).toString('hex');
export const trustCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: TRUST_DAYS * 86400,
};
