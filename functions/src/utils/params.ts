const BUCKET_NAME = process.env.BUCKET_NAME;
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS?.trim() as string;
const USE_FOLDER_STRUCTURE = process.env.USE_FOLDER_STRUCTURE;
const FOLDER_ID = process.env.FOLDER_ID?.trim() as string;

const MAXIMUM_FILE_SIZE = process.env.MAXIMUM_FILE_SIZE?.trim();
const FILE_TYPES = process.env.FILE_TYPES?.trim().toLowerCase();
const EXCLUDE_FILE_NAME_CONTAINS =
  process.env.EXCLUDE_FILE_NAME_CONTAINS?.trim();

export {
  BUCKET_NAME,
  EMAIL_ADDRESS,
  EXCLUDE_FILE_NAME_CONTAINS,
  FILE_TYPES,
  FOLDER_ID,
  MAXIMUM_FILE_SIZE,
  USE_FOLDER_STRUCTURE,
};
