# Firebase Admin Setup Instructions

To fix the "Could not load the default credentials" error, we need to set up Firebase Admin SDK credentials.

## Option 1: Generate Service Account Key (Recommended)

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `chef-choice-60cc3`
3. Go to Project Settings (gear icon) → Service accounts
4. Click "Generate new private key"
5. Download the JSON file

## Option 2: Use Firebase CLI (Alternative)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Get access token: `firebase auth:print-access-token`

## For Railway Deployment

Add the service account JSON as an environment variable:

1. Go to your Railway project dashboard
2. Go to Variables tab
3. Add new variable:
   - Name: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Value: The entire contents of the service account JSON file (as a string)

## For Local Development

Set the environment variable:
```bash
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"chef-choice-60cc3",...}'
```

Or create a `.env` file:
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"chef-choice-60cc3",...}
```