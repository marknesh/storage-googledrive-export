# Export Storage Files to Google Drive

**Author**: Mark Munene (**[https://github.com/marknesh](https://github.com/marknesh)**)

**Description**: Exports cloud storage files to google drive in real-time.

**Details**: Use this extension to export files from your cloud storage bucket to google drive in real-time.

> [!WARNING]
> This repository has been **archived** because service accounts no longer have a storage quota for uploading files to Drive.
>
> To continue using this functionality, switch to **Shared Drives**, which are fully supported in this [repository](https://github.com/marknesh/firebase-storage-to-google-drive).

## Important Steps

- Create a folder in Google Drive.

**To allow existing files to be uploaded to Google drive:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **halfway complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or else you will receive a warning message `Since there is no Google account associated with this email address...`, because the service account will not yet be created.

- This allows existing files to be uploaded to Google Drive immediately after this extension installation is complete, should you choose `yes` for that option.

- Go to [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam)

- Add role of `Service Account User` to the extension service account `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com`

- Add role of `Cloud Tasks Enqueuer` to the firebase admin sdk service account

- Go to [tasks queue](https://console.cloud.google.com/cloudtasks/) and edit `ext-storage-googledrive-export-export-fileTask` **Max retry duration** to `520` or a value below `540` (the maximum timeout for Firebase Cloud Functions V1) but not `0`. This is the maximum amount of time for retrying a failed task measured from when the task was first attempted. This adjustment ensures that retries do not occur after the function times out, which can happen when processing files that are too large.

**To upload new files to Google drive after extension is installed:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or check [the list of your service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).

**Installation of more than one extension instance:**

- If you install more than one instance of this extension, you must also share access to your folder with the new extension instance service account email which can be found [here](https://console.cloud.google.com/iam-admin/serviceaccounts).

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive API

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

**Configuration Parameters:**

- BUCKET_NAME: Which bucket do you want use? This field is `optional` , we will use the default bucket if left empty.

- FOLDER_PATH: Which folder do you want to listen to upload changes? Leave empty if you want to upload all files to Google Drive. Enter the full paths of the folders separated by commas.
  e.g `users/photos,gallery` or use curly braces for dynamic folders e.g `users/{userId}/images, projects/{projectId}/files`.

- FOLDER_ID: The ID of the folder in google drive where you want to export your files.This can be found in the url after creating or accessing the folder e.g `https://drive.google.com/drive/u/0/folders/{FOLDER_ID}`

- FILE_TYPES: The MIME types of the files you want to upload to Google drive. The most common MIME types can be referenced [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types). This field is `optional` e.g `image/jpeg` or to allow more than one MIME type, please separate each type with a comma e.g `image/jpeg,video/mp4`

- EXCLUDE_FILE_NAME_CONTAINS: Enter words or parts of file names to skip uploading certain files.  
  If a file name includes any of these, it won't be uploaded.  
  Example: `_500x500,_200x200`. This field is `optional`.

- MAXIMUM_FILE_SIZE: The maximum file size to upload to google drive in megabytes(MB). e.g `200` This field is `optional`.

- UPLOAD_EXISTING_FILES: Do you want to upload the existing files in your storage bucket to Google drive?

- USE_FOLDER_STRUCTURE: Do you want the uploaded files to follow the folder structure in cloud storage ? e.g if there is a sub-folder, it will also create a sub-folder. If this option is not allowed, only the file will be created, without the sub-folders.

- EMAIL_ADDRESS: The email address of the google drive account in which you added the service account. This allows you to view sub-folders in google drive.

- LOCATION: Where do you want to deploy the functions created for this extension?

**Cloud Functions:**

- **exportToDrive:** Storage triggered function that exports an uploaded file to google drive.
