import * as functions from 'firebase-functions';
import {
  extractPath,
  isAllowedFolder,
  authorizeAndUploadFile,
  checkFolderCreation,
} from './utils';
import { getStorage } from 'firebase-admin/storage';
import { getExtensions } from 'firebase-admin/extensions';
// import { getEventarc } from 'firebase-admin/eventarc';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

const storage = getStorage();

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_PATH = process.env.FOLDER_PATH;
const FILE_TYPES = process.env.FILE_TYPES;
const UPLOAD_EXISTING_FILES = process.env.UPLOAD_EXISTING_FILES;

// const eventChannel =
//   process.env.EVENTARC_CHANNEL &&
//   getEventarc().channel(process.env.EVENTARC_CHANNEL, {
//     allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
//   });

export const exportToDrive = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!object?.name) {
      functions.logger.warn('No object found');
      return 'No object found';
    }

    /* Check file type if specified */
    if (
      FILE_TYPES &&
      object.contentType &&
      !FILE_TYPES.includes(object.contentType)
    ) {
      functions.logger.warn(
        `File type (${object.contentType}) is not allowed, because you did not specify it in the Allowed File types parameter`
      );
      return `File type (${object.contentType}) is not allowed, because you did not specify it in the Allowed File types parameter`;
    }

    /* Check if user specified a FOLDER_PATH parameter */
    if (FOLDER_PATH) {
      const result = checkFolderCreation(object);

      if (result !== 'File exists') {
        return result;
      }

      const folderPaths = FOLDER_PATH.split(',');

      const folderWithObject = extractPath(object.name);

      if (isAllowedFolder(folderWithObject, folderPaths)) {
        return authorizeAndUploadFile(object);
      } else {
        functions.logger.warn(
          `Please upload files to one of the folder paths in (${FOLDER_PATH}) as you specified in the Cloud Storage folder parameter, in order for the extension to work.`
        );
        return `Please upload files to one of the folder paths in (${FOLDER_PATH}) as you specified in the Cloud Storage folder parameter, in order for the extension to work.`;
      }
    } else {
      const result = checkFolderCreation(object);
      if (result !== 'File exists') {
        return result;
      }

      await authorizeAndUploadFile(object);
      return
      // return (
      //   eventChannel &&
      //   (await eventChannel.publish({
      //     type: 'mark.storage-googledrive-export.v1.complete',
      //     data: {
      //       file: object.name,
      //     },
      //   }))
      // );
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
      .then(async (files) => {
        if (files[0].length > 0) {
          for (const file of files[0]) {
            const result = checkFolderCreation(file);
            if (result !== 'File exists') {
              continue;
            }

            await authorizeAndUploadFile(file);
          }

          return getExtensions()
            .runtime()
            .setProcessingState(
              'PROCESSING_COMPLETE',
              'Upload of existing files complete.'
            );
        } else {
          return 'No files found';
        }
      })
      .catch((error) => {
        functions.logger.warn(error.message);
        return error.message;
      });
  });
