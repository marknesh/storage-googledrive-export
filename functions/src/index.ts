import * as functions from 'firebase-functions';
import { authorize, uploadFile, extractPath, isAllowedFolder } from './utils';
import { getStorage } from 'firebase-admin/storage';

const storage = getStorage();

const LOCATION = process.env.LOCATION as string;
const BUCKET_NAME = process.env.BUCKET_NAME;
const FOLDER_PATH = process.env.FOLDER_PATH;
const FILE_TYPES = process.env.FILE_TYPES;
const UPLOAD_EXISTING_FILES = process.env.UPLOAD_EXISTING_FILES;

export const exportToDrive = functions.storage.object().onFinalize((object) => {
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
      `File type (${object.contentType}) is not allowed, because you did not specify it in the (Allowed File types) parameter`
    );
    return `File type (${object.contentType}) is not allowed, because you did not specify it in the (Allowed File types) parameter`;
  }

  if (FOLDER_PATH) {
    /* Check if user specified a FOLDER_PATH parameter */
    const lastSlashIndex = object.name.lastIndexOf('/');

    /* Cancel export if only the folder is created */
    if (!object.name.substring(lastSlashIndex + 1)) {
      return null;
    }

    const folderPaths = FOLDER_PATH.split(',');

    const folderWithObject = extractPath(object.name);

    if (isAllowedFolder(folderWithObject, folderPaths)) {
      return authorize()
        .then((authClient) => uploadFile(authClient, object))
        .catch((error) => {
          functions.logger.warn(error.message);
          return error.message;
        });
    } else {
      functions.logger.warn(
        `Please upload files to one of the folder paths in (${FOLDER_PATH}) as you specified in the FOLDER_PATH parameter, in order for the extension to work.`
      );
      return `Please upload files to one of the folder paths in (${FOLDER_PATH}) as you specified in the FOLDER_PATH parameter, in order for the extension to work.`;
    }
  } else {
    return authorize()
      .then((authClient) => uploadFile(authClient, object))
      .catch((error) => {
        functions.logger.warn(error.message);
        return error.message;
      });
  }
});

export const uploadtoDriveOnInstall = functions
  .region(LOCATION)
  .tasks.taskQueue()
  .onDispatch(async () => {
    if (UPLOAD_EXISTING_FILES) {
      await storage
        .bucket(BUCKET_NAME)
        .getFiles()
        .then(async (files) => {
          if (files[0].length > 0) {
            let uploadedFiles = files[0].map((file) => {
              /* Check if user specified a FOLDER_PATH parameter */
              const lastSlashIndex = file.name.lastIndexOf('/');

              /* Cancel export if only the folder is created */
              if (!file.name.substring(lastSlashIndex + 1)) {
                return null;
              }

              return authorize()
                .then((authClient) => uploadFile(authClient, file as any))
                .catch((error) => {
                  functions.logger.warn(error.message);
                  return error.message;
                });
            });

            await Promise.all(uploadedFiles);

            return 'Upload existing files complete';
          } else {
            return 'No files found';
          }
        })
        .catch((error) => {
          functions.logger.warn(error.message);
          return error.message;
        });
    } else {
      return;
    }
  });
