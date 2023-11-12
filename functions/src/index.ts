import * as functions from 'firebase-functions';
import { authorize, uploadFile, extractPath, isAllowedFolder } from './utils';

const FOLDER_PATH = process.env.FOLDER_PATH;
const FILE_TYPES = process.env.FILE_TYPES;

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
