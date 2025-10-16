import { FileMetadata } from '@google-cloud/storage';
import { config } from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import * as functions from 'firebase-functions';
import { ObjectMetadata } from 'firebase-functions/v1/storage';
import {
  EXCLUDE_FILE_NAME_CONTAINS,
  FILE_TYPES,
  MAXIMUM_FILE_SIZE,
  USE_FOLDER_STRUCTURE,
} from '../utils/params';

initializeApp();

// config is only used when testing
config();

/* Check if the folder with the object is in the list of allowed folders */
const isAllowedFolder = (objectName: string, folderPaths: string) => {
  const paths = folderPaths.split(',').map((path) => path.trim());

  return paths.some((folderPath) => {
    // Remove leading slash if it exists
    if (folderPath.startsWith('/')) {
      folderPath = folderPath.slice(1);
    }

    if (!folderPath.endsWith('/')) {
      folderPath += '/';
    }

    // Check if folderPath contains any curly braces {} (placeholders)
    if (
      !folderPath.includes('{') &&
      !folderPath.includes('}') &&
      objectName.startsWith(folderPath)
    ) {
      return true;
    }

    if (folderPath.includes('{') && folderPath.includes('}')) {
      // Replace all placeholders (inside { }) with a regex pattern to match any string except /
      const regexPattern = folderPath.replace(/\{[^}]+\}/g, '[^/]+');

      const regex = new RegExp(`^${regexPattern}$`);

      // Test the filePath against the regex
      return regex.test(objectName);
    } else {
      return false;
    }
  });
};

/**
 * Get the folder that contains the object
 *
 * @param {string} objectName
 *
 * @return {string} objectName
 */
function extractPath(objectName: string) {
  const slashesCount = (objectName.match(/\//g) || []).length;

  if (slashesCount >= 1) {
    const lastSlashIndex = objectName.lastIndexOf('/');
    return objectName.substring(0, lastSlashIndex + 1);
  } else {
    return objectName;
  }
}

const getFileName = (filePath: string) => {
  const slashesCount = (filePath.match(/\//g) || []).length;

  if (USE_FOLDER_STRUCTURE === 'true' && slashesCount > 0) {
    const secondLastSlashIndex = filePath.lastIndexOf('/');

    const name = filePath.slice(secondLastSlashIndex + 1);

    return name;
  } else {
    return filePath;
  }
};

const checkFolderCreation = (
  file: ObjectMetadata | FileMetadata
): string | void => {
  if (file.name) {
    const lastSlashIndex = file.name.lastIndexOf('/');

    /* Cancel export if only the folder is created */
    if (!file.name.substring(lastSlashIndex + 1)) {
      return 'Only folder was created';
    } else {
      return 'File exists';
    }
  } else {
    return 'No file name found';
  }
};

const bytesToMb = (bytes: number) => {
  return bytes / (1024 * 1024);
};

/**
 *
 *  Check the file size limit - if configured
 *
 * @param {FileMetadata} object
 * @return {string|void}
 */
const checkFileSizeLimit = (object: ObjectMetadata): string | void => {
  if (MAXIMUM_FILE_SIZE) {
    const fileSizeLimit = Number(MAXIMUM_FILE_SIZE);

    if (isNaN(fileSizeLimit)) {
      const warningMessage =
        'File Size limit configuration is not a valid number. Please enter only a number.';

      functions.logger.warn(warningMessage);

      return warningMessage;
    }

    let fileSizeinMb = bytesToMb(Number(object.size));

    /* Round up to two decimal places */
    fileSizeinMb = Math.round(fileSizeinMb * 100) / 100;

    if (fileSizeinMb > fileSizeLimit) {
      const warningMessage = `File size is greater than the maximum file size limit of ${fileSizeLimit}MB. You can always change this in the extension configuration.`;

      functions.logger.warn(warningMessage);

      return warningMessage;
    }
  }
};

/**
 * Check file type - if configured
 *
 * @param {FileMetadata} object
 * @return {string|void}
 */
const checkFileType = (object: ObjectMetadata): void | string => {
  if (
    FILE_TYPES &&
    object.contentType &&
    !FILE_TYPES.includes(object.contentType)
  ) {
    const warningMessage = `File type (${object.contentType}) is not allowed, because you did not specify it in the Allowed File types parameter`;

    functions.logger.warn(warningMessage);

    return warningMessage;
  }
};

/**
 * Check if file names includes excluded words
 *
 * @param {ObjectMetadata} object
 * @return {boolean}
 */
const isAllowedFileName = (object: ObjectMetadata): boolean => {
  if (!EXCLUDE_FILE_NAME_CONTAINS) {
    return true;
  }

  const excludedNames = EXCLUDE_FILE_NAME_CONTAINS.split(',').map((word) =>
    word.trim()
  );

  const isAllowed = !excludedNames.some(
    (excluded) => object.name && object.name.includes(excluded)
  );

  if (!isAllowed) {
    const warningMessage = `File (${object.name}) will not be uploaded to drive since the file name includes a word from the excluded list (${EXCLUDE_FILE_NAME_CONTAINS}) in the extension configuration.`;
    functions.logger.warn(warningMessage);
  }

  return isAllowed;
};

export {
  bytesToMb,
  checkFileSizeLimit,
  checkFileType,
  checkFolderCreation,
  extractPath,
  getFileName,
  isAllowedFileName,
  isAllowedFolder,
};
