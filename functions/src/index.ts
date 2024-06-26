import * as functions from 'firebase-functions';
import {
  extractPath,
  isAllowedFolder,
  authorizeAndUploadFile,
  checkFolderCreation,
  cachedDriveFolders,
  bytesToMb,
} from './utils';
import { getStorage } from 'firebase-admin/storage';
import { getExtensions } from 'firebase-admin/extensions';
import { getEventarc } from 'firebase-admin/eventarc';

const storage = getStorage();

const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_PATH = process.env.FOLDER_PATH;
const FILE_TYPES = process.env.FILE_TYPES;
const UPLOAD_EXISTING_FILES = process.env.UPLOAD_EXISTING_FILES;
const MAXIMUM_FILE_SIZE = process.env.MAXIMUM_FILE_SIZE;

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

    /* Check for file size limit */
    if (MAXIMUM_FILE_SIZE) {
      let fileSizeinMb = bytesToMb(Number(object.size));

      /* Round up to two decimal places */
      fileSizeinMb = Math.round(fileSizeinMb * 100) / 100;

      const fileSizeLimit = Number(MAXIMUM_FILE_SIZE);
      if (fileSizeinMb > fileSizeLimit) {
        functions.logger.warn(
          `File size is greater than the maximum file size limit of ${fileSizeLimit}MB`
        );
        return `File size is greater than the maximum file size limit of ${fileSizeLimit}MB`;
      }
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

            await authorizeAndUploadFile(file);
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
