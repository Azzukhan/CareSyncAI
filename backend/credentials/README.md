# Wallet Credentials

Do not commit real Apple Wallet or Google Wallet private credentials to git.

Place local issuer credentials here:

- `credentials/apple/pass_certificate.p12`
- `credentials/apple/AppleWWDRCAG6.cer`
- `credentials/google/service-account.json`

These files are ignored by git.

## Apple Wallet

Required values in `backend/.env`:

- `APPLE_WALLET_TEAM_ID`
- `APPLE_WALLET_PASS_TYPE_ID`
- `APPLE_WALLET_ORGANIZATION_NAME`
- `APPLE_WALLET_CERTIFICATE_P12_PATH`
- `APPLE_WALLET_CERTIFICATE_P12_PASSWORD`
- `APPLE_WALLET_WWDR_CERTIFICATE_PATH`

Typical flow:

1. Join the Apple Developer Program with an Account Holder or Admin account.
2. In Certificates, Identifiers & Profiles, create a Pass Type ID.
3. Create a Pass Type ID certificate for that Pass Type ID.
4. On macOS, create the CSR in Keychain Access.
5. Download the Apple-issued `.cer` certificate and import it into Keychain Access.
6. Export the certificate plus private key from Keychain Access as a `.p12`.
7. Download the current Apple WWDR intermediate certificate and place it here.

## Google Wallet

Required values in `backend/.env`:

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_PATH`

Typical flow:

1. Create a Google Wallet Issuer account in the Google Pay & Wallet console.
2. Enable the Google Wallet API in the Google Cloud project you will use.
3. Create a Google Cloud service account.
4. Create and download a JSON key for that service account.
5. Add the service account email to the Wallet issuer account as a `Developer`.
6. Put the downloaded JSON file in `credentials/google/service-account.json`.

## Security

- Rotate credentials if a private key or JSON key is ever shared.
- Keep these files server-side only.
- Never expose them to the frontend bundle.
