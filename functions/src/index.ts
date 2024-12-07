import { getEventarc } from 'firebase-admin/eventarc';
import { getExtensions } from 'firebase-admin/extensions';
import { getFunctions } from 'firebase-admin/functions';
import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions/v1';
import {
  authorizeAndUploadFile,
  cachedDriveFolders,
  checkFileSizeLimit,
  checkFileType,
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

exports.fileTask = functions.tasks
  .taskQueue({
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 6,
    },
  })
  .onDispatch(async (data) => {
    console.log(data);
    functions.logger.warn('uploading file');
    await authorizeAndUploadFile(data.file, true);
    console.log('uplaoded file complete');
    return data;
  });

export const exportToDrive = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!object?.name) {
      functions.logger.warn('No object found');
      return 'No object found';
    }

    /* Check file size */
    const fileSizeWarning = checkFileSizeLimit(object);

    if (fileSizeWarning) return fileSizeWarning;

    /* Check file type */
    const fileTypeWarning = checkFileType(object);

    if (fileTypeWarning) return fileTypeWarning;

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
      .then(async (files) => {
        console.log(files);
        if (files[0].length > 0) {
          for (const file of files[0]) {
            const result = checkFolderCreation(file.metadata);
            if (result !== 'File exists') {
              continue;
            }

            functions.logger.log(`${process.env.EXT_INSTANCE_ID}-fileTask`);

            const queue = getFunctions().taskQueue(
              `${process.env.EXT_INSTANCE_ID}-fileTask`
            );

            return await queue.enqueue({ file }, { scheduleDelaySeconds: 10 });
          }

          cachedDriveFolders.length = 0;

          getExtensions()
            .runtime()
            .setProcessingState(
              'PROCESSING_COMPLETE',
              'Upload of existing files complete.'
            );

          const existingFiles = files[0].map((file) => {
            return {
              id: file.id,
              name: file.name,
              bucket: file.bucket,
              contentType: file.metadata.contentType,
              mediaLink: file.metadata.mediaLink,
              size: file.metadata.size,
              selfLink: file.metadata.selfLink,
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
