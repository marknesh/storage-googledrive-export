import { FileMetadata } from '@google-cloud/storage';
import axios from 'axios';
import { getDownloadURL, getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import { ObjectMetadata } from 'firebase-functions/v1/storage';
import { drive_v3 as driveV3, google } from 'googleapis';
import { getFileName } from '.';
import {
  BUCKET_NAME,
  EMAIL_ADDRESS,
  FOLDER_ID,
  USE_FOLDER_STRUCTURE,
} from '../utils/params';
import { authorize } from './auth';

const storage = getStorage();

let currentParentId: string = FOLDER_ID;

/**
 *
 * @param {FileMetadata} object
 * @return {string} File uploaded successfully
 */
export const authorizeAndUploadFile = (
  object: ObjectMetadata | FileMetadata
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

/**
 * Exports file to google drive
 *
 * @param {JWT} authClient
 * @param {FileMetadata} object
 * @return {string} File uploaded successfully
 */
export async function uploadFile(
  // eslint-disable-next-line
  authClient: any,
  object: FileMetadata | ObjectMetadata
) {
  if (object?.name) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileRef = await storage.bucket(BUCKET_NAME).file(object.name);
    const url = await getDownloadURL(fileRef);

    const slashesCount = (object.name.match(/\//g) || []).length;

    if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
      const response = await createSubFolders(object.name, drive);

      /* if no currentParentId ,stop upload */
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
                body: imageStream,
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

export const createSubFolders = async (
  filePath: string,
  drive: driveV3.Drive
) => {
  currentParentId = FOLDER_ID;

  const lastSlash = filePath.lastIndexOf('/');
  const folders = filePath.substring(0, lastSlash).split('/');

  let response;

  for (const folder of folders) {
    const driveFolders = await drive.files.list({
      q: `name='${folder}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
    });

    const folderExists =
      driveFolders?.data?.files && driveFolders?.data.files?.length > 0;

    if (folderExists) {
      const id = driveFolders?.data?.files && driveFolders?.data?.files[0]?.id;

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
      }
    }
  }

  return response;
};
