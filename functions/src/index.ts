import { getEventarc } from 'firebase-admin/eventarc';
import { getExtensions } from 'firebase-admin/extensions';
import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import {
  authorizeAndUploadFile,
  cachedDriveFolders,
  checkFolderCreation,
  extractPath,
  isAllowedFolder,
} from './utils';

const storage = getStorage();

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_PATH = process.env.FOLDER_PATH?.trim();
const UPLOAD_EXISTING_FILES = process.env.UPLOAD_EXISTING_FILES;
const USE_FOLDER_STRUCTURE = process.env.USE_FOLDER_STRUCTURE;

const eventChannel =
  process.env.EVENTARC_CHANNEL &&
  getEventarc().channel(process.env.EVENTARC_CHANNEL, {
    allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
  });

export const exportToDrive = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!object?.name) {
      functions.logger.warn('No object found');
      return 'No object found';
    }

    /* Check if USE_FOLDER_STRUCTURE configuration is false but FOLDER_PATH config is true  */
    if (USE_FOLDER_STRUCTURE === 'false' && FOLDER_PATH) {
      const warningMessage =
        'You have set a folder path but the use folder structure configuration is still false, Please set it to true or leave the folder path empty';

      functions.logger.warn(warningMessage);

      return warningMessage;
    }

    /* Check if USE_FOLDER_STRUCTURE configuration is true but FOLDER_PATH config is false */
    if (USE_FOLDER_STRUCTURE === 'true' && !FOLDER_PATH) {
      const warningMessage =
        'Please set a folder path in the configuration, since you selected to use the same folder structure';

      functions.logger.warn(warningMessage);

      return warningMessage;
    }

    /* Check if the uploaded file path matches FOLDER_PATH configuration */
    if (USE_FOLDER_STRUCTURE === 'true' && FOLDER_PATH) {
      const result = checkFolderCreation(object);

      if (result !== 'File exists') {
        return result;
      }

      const folderWithObject = extractPath(object.name);

      const folderPaths = FOLDER_PATH;

      if (isAllowedFolder(folderWithObject, folderPaths)) {
        return authorizeAndUploadFile(object);
      } else {
        const warningMessage = `Please upload files to one of the folder paths in (${FOLDER_PATH}) as you specified in the Cloud Storage folder parameter, in order for the extension to work.`;

        functions.logger.warn(warningMessage);

        return warningMessage;
      }
    } else {
      const result = checkFolderCreation(object);
      if (result !== 'File exists') {
        return result;
      }

      const response = await authorizeAndUploadFile(object);

      cachedDriveFolders.length = 0;

      return eventChannel
        ? await eventChannel.publish({
            type: 'mark.storage-googledrive-export.v1.complete',
            data: {
              file: object,
            },
          })
        : response;
    }
  });

export const uploadtoDriveOnInstall = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    if (UPLOAD_EXISTING_FILES === 'false') {
      return getExtensions()
        .runtime()
        .setProcessingState(
          'PROCESSING_COMPLETE',
          'Upload of existing files skipped.'
        );
    }

    return storage
      .bucket(BUCKET_NAME)
      .getFiles()
      .then(async (files: functions.storage.ObjectMetadata[][]) => {
        if (files[0].length > 0) {
          for (const file of files[0]) {
            const result = checkFolderCreation(file);
            if (result !== 'File exists') {
              continue;
            }

            await authorizeAndUploadFile(file, true);
          }

          cachedDriveFolders.length = 0;

          getExtensions()
            .runtime()
            .setProcessingState(
              'PROCESSING_COMPLETE',
              'Upload of existing files complete.'
            );

          const existingFiles = files.map((file) => {
            return {
              id: file[0].id,
              name: file[0].name,
              bucket: file[0].bucket,
              contentType: file[0].contentType,
              mediaLink: file[0].mediaLink,
              size: file[0].size,
              selfLink: file[0].selfLink,
            };
          });

          return (
            eventChannel &&
            (await eventChannel.publish({
              type: 'mark.storage-googledrive-export.v1.complete',
              data: {
                existingFiles,
              },
            }))
          );
        } else {
          functions.logger.log('No existing files found');
          return 'No files found';
        }
      })
      .catch((error) => {
        functions.logger.warn(error.message);
        return error.message;
      });
  });
