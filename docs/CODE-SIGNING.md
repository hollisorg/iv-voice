# Code signing with Azure Artifact Signing

Signing puts a verified publisher name on the installer and app, so Windows SmartScreen stops
showing "Windows protected your PC / Unknown publisher". Microsoft's service for this is
**Azure Artifact Signing** (it used to be called Trusted Signing). electron-builder supports it
directly, and the release workflow already wires it in. You only need to create the account and
hand over five values.

## Who can use it

Microsoft's public-trust certificates are available to:
- **organizations** in the US, Canada, the EU and the UK, and
- **individual developers** in the US and Canada.

If you sign as **The Hollis Organization**, Microsoft verifies the business. If you sign as yourself,
it verifies your identity. The name you're verified under is what people see as the publisher.

There is a monthly fee for the Basic tier. Check the current price on the
[pricing page](https://azure.microsoft.com/pricing/details/artifact-signing/) before you subscribe.

## Steps (you do these; they need your identity and payment)

1. **Azure subscription.** Sign in at portal.azure.com (or create a subscription) with the account
   that should own the signing setup.
2. **Create an Artifact Signing account.** Search the portal for "Artifact Signing", create an account
   in a nearby region (e.g. East US) and pick the Basic tier. Note:
   - the **account name**
   - the **endpoint** URL shown on its overview page (e.g. `https://eus.codesigning.azure.net/`)
3. **Identity validation.** In the account, open *Identity validations → New → Public*. Fill in the
   organization or individual details exactly as they appear on official documents, then complete
   Microsoft's verification. This can take from hours to several business days.
4. **Certificate profile.** Once validation is approved, create a *Certificate profile* of type
   **Public Trust** using that validation. Note the **profile name**. The publisher name people will
   see is the validated name, which is the **publisher name** value.
5. **App registration for GitHub Actions.** In *Microsoft Entra ID → App registrations*, create one
   (e.g. `iv-downloader-signing`), then add a **client secret**. Note the **tenant ID**, **client
   ID** and **secret value** (it's shown only once).
6. **Permission.** On the Artifact Signing account, open *Access control (IAM) → Add role assignment*
   and give that app registration the **Artifact Signing Certificate Profile Signer** role (it may
   still be listed as *Trusted Signing Certificate Profile Signer*).

## Hand-off to the repository

In GitHub, open the repo's *Settings → Secrets and variables → Actions* and add these.

Secrets:
| Name | Value |
|---|---|
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | App registration's client ID |
| `AZURE_CLIENT_SECRET` | The client secret value |

Variables:
| Name | Value |
|---|---|
| `AZURE_SIGNING_ENDPOINT` | e.g. `https://eus.codesigning.azure.net/` |
| `AZURE_SIGNING_ACCOUNT` | Artifact Signing account name |
| `AZURE_CERTIFICATE_PROFILE` | Certificate profile name |
| `AZURE_PUBLISHER_NAME` | The validated publisher name, exactly as on the certificate |

Never paste these into chat, commit them, or put them in this file.

The next tagged release signs the app, every bundled `.exe` (ffmpeg, ffprobe, Deno), the uninstaller
and the installer. The workflow fails if signing doesn't produce a valid signature.

## Until signing is ready

Set the repository variable `ALLOW_UNSIGNED` to `true` to publish unsigned builds. People will see the
SmartScreen warning and can click *More info → Run anyway*. Remove the variable once signing works.

## What signing does and doesn't do

- It shows your verified publisher name and proves the file hasn't been altered since you signed it.
- SmartScreen also weighs reputation. A brand-new publisher can still see warnings for a short time,
  until enough people have installed the app.
- Signing doesn't stop antivirus false positives on downloader tools, though it makes them rarer. If
  one happens, submit the file to the vendor (Microsoft: https://www.microsoft.com/wdsi/filesubmission).
