import { config } from 'dotenv';
import * as functions from 'firebase-functions';
import { drive_v3 as driveV3, google } from 'googleapis';
import axios from 'axios';
import { Readable } from 'node:stream';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase-admin/app';
initializeApp();

config();

const BUCKET_NAME = process.env.BUCKET_NAME;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS?.trim() as string;
const USE_FOLDER_STRUCTURE = process.env.USE_FOLDER_STRUCTURE;
const FOLDER_ID = process.env.FOLDER_ID?.trim() as string;

const storage = getStorage();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

let currentParentId: string = FOLDER_ID;

export const cachedDriveFolders: cachedDriveFoldersProps[] = [];

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
  currentParentId = FOLDER_ID;

  const firstSlash = filePath.indexOf('/');
  const lastSlash = filePath.lastIndexOf('/');
  const folders = filePath.substring(0, lastSlash).split('/');
  const firstFolder = filePath.substring(0, firstSlash);
  let response;

  for (const [index, folder] of folders.entries()) {
    const driveFolders = await drive.files.list({
      q: `name='${folder}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
    });

    const filteredCachedFolders = cachedDriveFolders.filter(
      (file) =>
        file.index === index &&
        file.folder === folder &&
        file.firstFolder === firstFolder
    );

    const folderExists =
      driveFolders?.data?.files && driveFolders?.data.files?.length > 0;

    /* drive api takes time to load newly created files, so will use it only when
    the folder does not exist in local cache.

    https://stackoverflow.com/questions/67571418/google-drive-api-files-list-not-refreshing
    */

    if (filteredCachedFolders?.length > 0 || folderExists) {
      const id =
        filteredCachedFolders[0]?.id ||
        (driveFolders?.data?.files && driveFolders?.data?.files[0]?.id);

      if (id) {
        currentParentId = id;
        response = { data: { id: `${id}` } };
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

        cachedDriveFolders.push({
          folder,
          index,
          id: driveResponse?.data?.id,
          firstFolder,
        });
      }
    }
  }

  return response;
};

const getFileName = (filePath: string) => {
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
 * @param {FileMetadata} object
 * @return {string} File uploaded successfully
 */
async function uploadFile(
  // eslint-disable-next-line
  authClient: any,
  object: FileMetadata
) {
  if (object?.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket(BUCKET_NAME).file(object.name);
    const url = await getDownloadURL(fileRef);

    const slashesCount = (object.name.match(/\//g) || []).length;

    if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
      const response = await createSubFolders(object.name, drive);

      if (!response?.data?.id) return;
    }

    if (slashesCount === 0) {
      currentParentId = FOLDER_ID;
    }

    const driveFile = await drive.files.list({
      q: `name='${getFileName(
        object.name
      )}' and '${currentParentId}' in parents and trashed = false`,
    });

    if (driveFile?.data?.files && driveFile?.data?.files?.length > 0) {
      functions.logger.warn(
        `File already exists in drive with file id ${
          driveFile?.data?.files && driveFile.data?.files[0]?.id
        }`
      );

      return `File already exists in drive with file id ${
        driveFile?.data?.files && driveFile?.data?.files[0]?.id
      }`;
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
              fields: 'id,name',
              requestBody: {
                name: getFileName(object.name),
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
 * @param {FileMetadata} object
 * @return {string} File uploaded successfully
 */
const authorizeAndUploadFile = (object: FileMetadata) => {
  return authorize()
    .then((authClient) => {
      return uploadFile(authClient, object);
    })
    .catch((error) => {
      functions.logger.warn(error.message);
      return error.message;
    });
};

const checkFolderCreation = (file: FileMetadata): string | void => {
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
