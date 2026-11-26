# Code signing

## Windows release builds

Sign in to the Hollis Organization tenant with Azure CLI, using an account with the
Artifact Signing Certificate Profile Signer role on the iv-windows certificate profile.
Install the Windows SDK (22621 or newer, with x64 SignTool) and the .NET 10 x64 runtime.
Run `npm run dist:win-release` to build and verify Windows release assets in `dist/`.

The scripts sign Windows executables and the NSIS installer before Electron Builder generates
the updater manifest and blockmap. The build verifies the Hollis Organization Inc publisher,
the Microsoft timestamp, and the installer checksum in the manifest.

Tagged Windows release jobs use Azure login with GitHub OIDC. The `windows-signing` environment
allows only `v*` tags. It supplies `IV_SIGNING_AZURE_CLIENT_ID` and `IV_SIGNING_AZURE_TENANT_ID`
as GitHub Actions variables. The federated credential matches this repository’s immutable GitHub
subject and the environment. Its Azure Signer role applies only to the `iv-windows` profile.
A Windows release job stops on any authentication, signing, or verification failure.
