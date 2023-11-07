import * as functions from 'firebase-functions';
import {
  authorize,
  uploadFile,
  extractPath,
  isAllowedFolder,
} from './utils';

const FOLDER_PATH = process.env.FOLDER_PATH;

export const exportToDrive = functions.storage.object().onFinalize((object) => {
  if (!object?.name) {
    functions.logger.warn('No object found');
    return 'No object found';
  }
  /* Check if user specified a FOLDER_PATH parameter */
  if (FOLDER_PATH) {
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
