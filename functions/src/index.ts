import * as functions from 'firebase-functions';
import { authorize, uploadFile } from './utils';

const FOLDER_PATH = process.env.FOLDER_PATH;

exports.exportToDrive = functions.storage.object().onFinalize((object) => {
  /* Check if user specified a FOLDER_PATH parameter */
  if (FOLDER_PATH) {
    /* Check if object name starts with the folder path */
    if (object?.name?.startsWith(FOLDER_PATH)) {
      const lastSlashIndex = object.name.lastIndexOf('/');

      /* Cancel export if only the folder is created */
      if (!object.name.substring(lastSlashIndex + 1)) {
        return null;
      }

      const renamedObject = {
        ...object,
        name: object.name.substring(lastSlashIndex + 1),
      };

      return authorize()
        .then((authClient) => uploadFile(authClient, renamedObject))
        .catch((error) => {
          functions.logger.warn(error.message);
        });
    } else {
      functions.logger.warn(
        `Please upload files to the folder path (${FOLDER_PATH}) as you specified in the FOLDER_PATH parameter, in order for the extension to work.`
      );
      return null;
    }
  } else {
    return authorize()
      .then((authClient) => uploadFile(authClient, object))
      .catch((error) => {
        functions.logger.warn(error.message);
      });
  }
});
