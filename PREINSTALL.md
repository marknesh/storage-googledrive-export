Use this extension to export files from your cloud storage bucket to google drive in real-time.

When a file is uploaded to cloud storage, this extension uploads that file to google drive.


> **Caution:** Setting cloud functions max instances to more than one might create duplicate folders since Google Drive API takes time to reflect the latest data, hence the API might show no folders exist, when indeed a folder has already been created. For this reason, please use **only one instance**. The default is already set to 1, so no additional configuration is needed.

## Important Steps

- Create a folder in Google Drive.

**To allow existing files to be uploaded to Google drive:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **halfway complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or else you will receive a warning message `Since there is no Google account associated with this email address...`, because the service account will not yet be created.
- This allows existing files to be uploaded to Google Drive immediately after this extension installation is complete, should you choose `yes` for that option.

**To upload new files to Google drive after extension is installed:**

- **Share Editor** access to your folder with the **Extension Service Account Email** when the extension installation is **complete**, in the format `ext-storage-googledrive-export@<YOUR-PROJECT-ID>.iam.gserviceaccount.com` or check [the list of your service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).

**Installation of more than one extension instance:**

- If you install more than one instance of this extension, you must also share access to your folder with the new extension instance service account email which can be found [here](https://console.cloud.google.com/iam-admin/serviceaccounts).

## Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Functions
- Cloud Storage
- Google Drive API

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
