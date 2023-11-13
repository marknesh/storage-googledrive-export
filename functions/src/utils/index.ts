import { config } from 'dotenv';
import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';
import { File } from '@google-cloud/storage';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

config();

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_ID = process.env.FOLDER_ID as string;

const storage = getStorage();

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/* Check if the folder with the object is in the list of allowed folders */
const isAllowedFolder = (objectName: string, folderPaths: string[]) => {
  return folderPaths.some((str) => objectName.includes(str.trim()));
};

/**
 * Get the folder that contains the object
 *
 * @param {string} objectName
 *
 * @return {string} objectName
 */
function extractPath(objectName: string) {
  const slashesCount = (objectName.match(/\//g) || []).length;

  if (slashesCount > 1) {
    const secondLastSlashIndex = objectName.lastIndexOf(
      '/',
      objectName.lastIndexOf('/') - 1
    );
    return objectName.slice(secondLastSlashIndex + 1);
  } else {
    return objectName;
  }
}

/**
 * Authorize with default service account and get the JWT client
 *
 * @return {JWT} jwtClient
 *
 */
async function authorize() {
  const JWTClient = await google.auth.getClient({
    scopes: SCOPES,
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  return JWTClient;
}

/**
 * Exports file to google drive
 *
 * @param {JWT} authClient
 * @param {functions.storage.ObjectMetadata|File} object
 * @return {string} File uploaded successfully
 */
async function uploadFile(
  // eslint-disable-next-line
  authClient: any,
  object: functions.storage.ObjectMetadata | File
) {
  if (object.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket(BUCKET_NAME).file(object.name);
    const url = await getDownloadURL(fileRef);
    return axios
      .get(url, {
        responseType: 'stream',
      })
      .then(async (response) => {
        const imageStream = response.data;

        return await drive.files
          .create({
            media: {
              body: Readable.from(imageStream),
            },
            fields: 'id',
            requestBody: {
              name: object.name,
              parents: [FOLDER_ID],
            },
          })
          .then((res) => {
            functions.logger.info(
              `File uploaded successfully with id ${res.data.id}`
            );

            return 'File uploaded successfully';
          })
          .catch((error) => {
            functions.logger.warn(error.message);
            return error.message;
          });
      })
      .catch((error) => {
        functions.logger.warn(error.message);
        return error.message;
      });
  } else {
    functions.logger.warn('No media link found');
    return 'No media link found';
  }
}

/**
 *
 * @param {functions.storage.ObjectMetadata | File} object
 * @return {string} File uploaded successfully
 */
const authorizeAndUploadFile = (
  object: functions.storage.ObjectMetadata | File
) => {
  return authorize()
    .then((authClient) => uploadFile(authClient, object))
    .catch((error) => {
      functions.logger.warn(error.message);
      return error.message;
    });
};

export {
  authorize,
  uploadFile,
  extractPath,
  isAllowedFolder,
  authorizeAndUploadFile,
};
