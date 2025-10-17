import { google } from 'googleapis';
import { GOOGLE_APPLICATION_CREDENTIALS } from './params';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Authorize with default service account and get the JWT client
 *
 * @return {JWT} jwtClient
 *
 */
export async function authorize() {
  console.log(GOOGLE_APPLICATION_CREDENTIALS);
  const JWTClient = await google.auth.getClient({
    scopes: SCOPES,
    keyFile: GOOGLE_APPLICATION_CREDENTIALS,
  });

  return JWTClient;
}
