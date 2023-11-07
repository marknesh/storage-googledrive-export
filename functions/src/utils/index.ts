import { config } from 'dotenv';
import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { initializeApp } from 'firebase-admin/app';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';

initializeApp();

const storage = getStorage();

config({});

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const FOLDER_ID = process.env.FOLDER_ID as string;

/* Check if the folder with the object is in the list of allowed folders */
const isAllowedFolder = (objectName: string, folderPaths: string[]) => {
  return folderPaths.some((str) => objectName.includes(str.trim()));
};

/* Get the folder that contains the object */
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
 * @param {functions.storage.ObjectMetadata} object
 * @return {string} File uploaded successfully
 */
async function uploadFile(
  authClient: any,
  object: functions.storage.ObjectMetadata
) {
  if (object.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket().file(object.name);
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
              mimeType: object.contentType,
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

export { authorize, uploadFile, extractPath, isAllowedFolder };
