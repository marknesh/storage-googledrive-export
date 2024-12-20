import axios from 'axios';
import { config } from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import { drive_v3 as driveV3, google } from 'googleapis';
import { Readable } from 'node:stream';
initializeApp();

config();

const BUCKET_NAME = process.env.BUCKET_NAME;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS?.trim() as string;
const USE_FOLDER_STRUCTURE = process.env.USE_FOLDER_STRUCTURE;
const FOLDER_ID = process.env.FOLDER_ID?.trim() as string;
const GOOGLE_APPLICATION_CREDENTIALS =
  process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
const MAXIMUM_FILE_SIZE = process.env.MAXIMUM_FILE_SIZE?.trim();
const FILE_TYPES = process.env.FILE_TYPES?.trim().toLowerCase();

const storage = getStorage();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

let currentParentId: string = FOLDER_ID;

export const cachedDriveFolders: cachedDriveFoldersProps[] = [];

/* Check if the folder with the object is in the list of allowed folders */
const isAllowedFolder = (objectName: string, folderPaths: string) => {
  const paths = folderPaths.split(',').map((path) => path.trim());

  return paths.some((folderPath) => {
    // Check if folderPath contains any curly braces {} (placeholders)
    if (!folderPath.endsWith('/')) {
      folderPath += '/';
    }

    if (
      !folderPath.includes('{') &&
      !folderPath.includes('}') &&
      objectName.startsWith(folderPath)
    ) {
      return true;
    }

    if (folderPath.includes('{') && folderPath.includes('}')) {
      // Replace all placeholders (inside { }) with a regex pattern to match any string except /
      const regexPattern = folderPath.replace(/\{[^}]+\}/g, '[^/]+');

      const regex = new RegExp(`^${regexPattern}$`);

      // Test the filePath against the regex
      return regex.test(objectName);
    } else {
      return false;
    }
  });
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

  if (slashesCount >= 1) {
    const lastSlashIndex = objectName.lastIndexOf('/');
    return objectName.substring(0, lastSlashIndex + 1);
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
    keyFile: GOOGLE_APPLICATION_CREDENTIALS,
  });

  return JWTClient;
}

const createSubFolders = async (
  filePath: string,
  drive: driveV3.Drive,
  uploadingExistingFiles?: boolean
) => {
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

    const folderPath = folders.slice(0, index + 1).join('/');

    const filteredCachedFolders = uploadingExistingFiles
      ? cachedDriveFolders.filter(
          (file) =>
            file.index === index &&
            file.folder === folder &&
            file.firstFolder === firstFolder &&
            file.folderPath === folderPath
        )
      : null;

    const folderExists =
      driveFolders?.data?.files && driveFolders?.data.files?.length > 0;

    /* drive api takes time to load newly created files, so will use it only when
    the folder does not exist in local cache.> Cache is used only when
    uploading existing files since firebase cloud functions are stateless

    https://stackoverflow.com/questions/67571418/google-drive-api-files-list-not-refreshing
    */

    if (
      (filteredCachedFolders && filteredCachedFolders?.length > 0) ||
      folderExists
    ) {
      const id =
        (filteredCachedFolders && filteredCachedFolders[0]?.id) ||
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
          folderPath,
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
 * @param {boolean} uploadingExistingFiles
 * @return {string} File uploaded successfully
 */
async function uploadFile(
  // eslint-disable-next-line
  authClient: any,
  object: FileMetadata,
  uploadingExistingFiles?: boolean
) {
  if (object?.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket(BUCKET_NAME).file(object.name);
    const url = await getDownloadURL(fileRef);

    const slashesCount = (object.name.match(/\//g) || []).length;

    if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
      const response = await createSubFolders(
        object.name,
        drive,
        uploadingExistingFiles
      );

      if (!response?.data?.id) return;
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
    const warningMessage = 'No media link found';

    functions.logger.warn(warningMessage);

    return warningMessage;
  }
}

/**
 *
 * @param {FileMetadata} object
 * @param {boolean} uploadingExistingFiles
 * @return {string} File uploaded successfully
 */
const authorizeAndUploadFile = (
  object: FileMetadata,
  uploadingExistingFiles?: boolean
) => {
  return authorize()
    .then((authClient) => {
      return uploadFile(authClient, object, uploadingExistingFiles);
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

const bytesToMb = (bytes: number) => {
  return bytes / (1024 * 1024);
};

/**
 *
 *  Check the file size limit - if configured
 *
 * @param {FileMetadata} object
 * @return {string|void}
 */
const checkFileSizeLimit = (object: FileMetadata): string | void => {
  if (MAXIMUM_FILE_SIZE) {
    const fileSizeLimit = Number(MAXIMUM_FILE_SIZE);

    if (isNaN(fileSizeLimit)) {
      const warningMessage =
        'File Size limit configuration is not a valid number. Please enter only a number.';

      functions.logger.warn(warningMessage);

      return warningMessage;
    }

    let fileSizeinMb = bytesToMb(Number(object.size));

    /* Round up to two decimal places */
    fileSizeinMb = Math.round(fileSizeinMb * 100) / 100;

    if (fileSizeinMb > fileSizeLimit) {
      const warningMessage = `File size is greater than the maximum file size limit of ${fileSizeLimit}MB. You can always change this in the extension configuration.`;

      functions.logger.warn(warningMessage);

      return warningMessage;
    }
  }
};

/**
 * Check file type - if configured
 *
 * @param {FileMetadata} object
 * @return {string|void}
 */
const checkFileType = (object: FileMetadata): void | string => {
  if (
    FILE_TYPES &&
    object.contentType &&
    !FILE_TYPES.includes(object.contentType)
  ) {
    const warningMessage = `File type (${object.contentType}) is not allowed, because you did not specify it in the Allowed File types parameter`;

    functions.logger.warn(warningMessage);

    return warningMessage;
  }
};

export {
  authorize,
  authorizeAndUploadFile,
  bytesToMb,
  checkFileSizeLimit,
  checkFileType,
  checkFolderCreation,
  extractPath,
  isAllowedFolder,
  uploadFile,
};
