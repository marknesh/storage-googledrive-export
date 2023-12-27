import { config } from 'dotenv';
import * as functions from 'firebase-functions';
import { drive_v3 as driveV3, google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';
import { File } from '@google-cloud/storage';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

config();

const BUCKET_NAME = process.env.BUCKET_NAME;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS?.trim() as string;
const USE_FOLDER_STRUCTURE = process.env.USE_FOLDER_STRUCTURE;
const emailError =
  'Please enter an email address in the config parameters, that you want give access to view sub-folders.';
const FOLDER_ID = process.env.FOLDER_ID?.trim() as string;

const storage = getStorage();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

let currentParentId: string = FOLDER_ID;

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

const createSubFolders = async (filePath: string, drive: driveV3.Drive) => {
  if (!EMAIL_ADDRESS) {
    functions.logger.warn(emailError);
    return emailError;
  }
  currentParentId = FOLDER_ID;
  const lastSlash = filePath.lastIndexOf('/');

  const folders = filePath.substring(0, lastSlash).split('/');

  let response;
  for (const folder of folders) {
    const driveFiles = await drive.files.list({
      q: `name='${folder}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents`,
    });

    if (driveFiles?.data?.files && driveFiles?.data?.files.length > 0) {
      const id = driveFiles?.data?.files[0]?.id;

      if (id) {
        currentParentId = id;
        response = await drive.permissions.create({
          fields: 'id',
          fileId: currentParentId,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: `${EMAIL_ADDRESS}`,
          },
          sendNotificationEmail: false,
        });
      }
    } else {
      const driveResponse = await drive.files.create({
        fields: 'id',
        requestBody: {
          name: folder,
          parents: [currentParentId],
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      if (driveResponse?.data?.id) {
        currentParentId = driveResponse?.data?.id;
        response = await drive.permissions.create({
          fields: 'id',
          fileId: currentParentId,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: `${EMAIL_ADDRESS}`,
          },
          sendNotificationEmail: false,
        });
      }
    }
  }
  return response;
};

const fileName = (filePath: string) => {
  const slashesCount = (filePath.match(/\//g) || []).length;

  if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
    const secondLastSlashIndex = filePath.lastIndexOf('/');

    const name = filePath.slice(secondLastSlashIndex + 1);

    return name;
  } else {
    return filePath;
  }
};

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
  if (object?.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket(BUCKET_NAME).file(object.name);
    const url = await getDownloadURL(fileRef);

    const slashesCount = (object.name.match(/\//g) || []).length;

    if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
      const response = await createSubFolders(object.name, drive);

      if (response === emailError || !response?.data?.id) return;
    }

    if (slashesCount === 0) {
      currentParentId = FOLDER_ID;
    }

    return await axios
      .get(url, {
        responseType: 'stream',
      })
      .then(async (response) => {
        if (object?.name) {
          const imageStream = response.data;

          return await drive.files
            .create({
              media: {
                body: Readable.from(imageStream),
              },
              fields: 'id',
              requestBody: {
                name: fileName(object.name),
                parents: [currentParentId],
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
        }
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
    .then((authClient) => {
      return uploadFile(authClient, object);
    })
    .catch((error) => {
      functions.logger.warn(error.message);
      return error.message;
    });
};

const checkFolderCreation = (
  file: functions.storage.ObjectMetadata | File
): string | void => {
  if (file.name) {
    const lastSlashIndex = file.name.lastIndexOf('/');

    /* Cancel export if only the folder is created */
    if (!file.name.substring(lastSlashIndex + 1)) {
      return 'Only folder was created';
    } else {
      return 'File exists';
    }
  } else {
    return 'No file name found';
  }
};

export {
  authorize,
  uploadFile,
  extractPath,
  isAllowedFolder,
  authorizeAndUploadFile,
  checkFolderCreation,
};
