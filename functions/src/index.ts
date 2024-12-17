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

export const exportToDrive = functions.storage
  .object()
  .onFinalize(async (object, event) => {
    /* prevent retry if large file (close to the timeout limit of 540 seconds) */
    const eventAgeMs = Date.now() - Date.parse(event.timestamp);
    const eventMaxAgeMs = 500000;
    if (eventAgeMs > eventMaxAgeMs) {
      return;
    }
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

exports.fileTask = functions.tasks.taskQueue().onDispatch(async (data) => {
  return authorizeAndUploadFile(data.file, true);
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
          const [files] = await storage.bucket(BUCKET_NAME).getFiles();

          for (const file of files) {
            const result = checkFolderCreation(file.metadata);
            if (result !== 'File exists') {
              continue;
            }

            const queue = getFunctions().taskQueue(
              `ext-${process.env.EXT_INSTANCE_ID}-fileTask`
            );

            await queue.enqueue({ file }, { scheduleDelaySeconds: 10 });
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
