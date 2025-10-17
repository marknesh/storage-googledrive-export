import { getEventarc } from 'firebase-admin/eventarc';
import { getFunctions } from 'firebase-admin/functions';
import * as functions from 'firebase-functions/v1';
import {
  checkFileSizeLimit,
  checkFileType,
  checkFolderCreation,
  extractPath,
  isAllowedFileName,
  isAllowedFolder,
} from './utils';
import { authorizeAndUploadFile } from './utils/upload';

const FOLDER_PATH = process.env.FOLDER_PATH?.trim();

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

    /* Check if file name is allowed */
    if (!isAllowedFileName(object)) {
      return;
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

      const queue = getFunctions().taskQueue(
        `locations/${process.env.FUNCTION_REGION}/functions/ext-${process.env.EXT_INSTANCE_ID}-fileTask`
      );

      // Since Google Drive API takes time to reflect the latest data,
      // the API might show no folders exist, when indeed a folder has already been created.
      // To prevent this, we use queue with a slight delay.
      const response = await queue.enqueue(
        { file: object },
        {
          scheduleDelaySeconds: 10,
        }
      );

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
  return authorizeAndUploadFile(data.file);
});
