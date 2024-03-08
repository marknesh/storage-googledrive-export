interface cachedDriveFoldersProps {
  folder: string;
  index: number;
  id: string;
  firstFolder: string;
}

type FileMetadata = import('firebase-functions/v1/storage').ObjectMetadata;
