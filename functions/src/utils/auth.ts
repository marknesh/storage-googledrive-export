import { initializeApp } from 'firebase-admin/app';
import { google } from 'googleapis';

initializeApp();

const GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Authorize with default service account and get the JWT client
 *
 * @return {JWT} jwtClient
 *
 */
export async function authorize() {
  const JWTClient = new google.auth.JWT({
    scopes: SCOPES,
    keyFile: GOOGLE_APPLICATION_CREDENTIALS,
  });

  return JWTClient;
}
