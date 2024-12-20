interface cachedDriveFoldersProps {
  folder: string;
  index: number;
  id: string;
  firstFolder: string;
  folderPath: string;
}

type FileMetadata = import('firebase-functions/v1/storage').ObjectMetadata;
