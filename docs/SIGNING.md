# Code Signing Setup

doc-md's release workflow signs installers automatically **once credentials
exist** — until then it builds unsigned and nothing breaks. This doc is the
one-time setup for each platform.

---

## Windows — Azure Artifact Signing

Microsoft's Azure Artifact Signing (formerly "Trusted Signing"): $9.99/month
Basic tier, unlimited signings, open to individual developers in the US/Canada.
Signed builds get SmartScreen reputation quickly — no more "Windows protected
your PC" scare screen for users.

### One-time Azure setup (~30 min of clicking + identity verification wait)

1. **Azure account**: sign up at <https://azure.microsoft.com> (credit card
   required; new accounts get free credit). Sign in to
   <https://portal.azure.com>.

2. **Create the signing account**: in the portal search bar, type
   **"Artifact Signing"** (older docs call it "Trusted Signing accounts" —
   same thing) → **Create**:
   - Resource group: create new, e.g. `docmd-signing`
   - Account name: globally unique, e.g. `paperhurts-signing`
   - Region: **East US** (endpoint will be `https://eus.codesigning.azure.net`)
     or **West US 2** (`https://wus2.codesigning.azure.net`) — note which!
   - Pricing: **Basic** ($9.99/mo)

3. **Identity validation** (the only slow step — start it ASAP):
   open your new account → **Identity validations** → **New** →
   **Individual**. Enter your legal name and address, then complete the
   government-ID verification it walks you through (photo ID + selfie via a
   link sent to your phone). Often completes within hours; can take a few
   days. Status must read **Completed** before step 4 works.

4. **Certificate profile**: in the account → **Certificate profiles** →
   **Create** → type **Public Trust**. Name it e.g. `docmd`, link it to your
   completed identity validation. The CN on the cert will be your verified
   legal name — that's what users see as the publisher.

5. **App registration** (the CI robot identity):
   portal search → **Microsoft Entra ID** → **App registrations** →
   **New registration**, name e.g. `docmd-ci`, defaults fine → Register.
   - Copy **Application (client) ID** and **Directory (tenant) ID** from the
     overview page.
   - **Certificates & secrets** → **New client secret** (24-month expiry) →
     copy the secret **Value** immediately (shown once).

6. **Grant the robot signing rights**: back on the Artifact Signing account →
   **Access control (IAM)** → **Add role assignment** → role
   **"Trusted Signing Certificate Profile Signer"** → assign to the
   `docmd-ci` app registration.

### Wire it into GitHub (run these yourself in the repo)

Secrets (sensitive — each command prompts for the value so it never lands in
shell history or chat):

```bash
gh secret set AZURE_TENANT_ID
gh secret set AZURE_CLIENT_ID
gh secret set AZURE_CLIENT_SECRET
```

Variables (not sensitive — visible in logs, which helps debugging):

```bash
gh variable set AZURE_SIGNING_ENDPOINT --body "https://eus.codesigning.azure.net"
gh variable set AZURE_SIGNING_ACCOUNT  --body "paperhurts-signing"
gh variable set AZURE_CERT_PROFILE     --body "docmd"
```

(Substitute your actual endpoint/account/profile names from steps 2 and 4.)

That's it. The next `v*` tag builds a signed `.exe` and `.msi` — the workflow
detects the credentials, installs `trusted-signing-cli`, and Tauri signs both
the app binary and the installer wrapping it.

### Verifying a signed build

```powershell
Get-AuthenticodeSignature .\doc-md_X.Y.Z_x64-setup.exe
```

`Status` should be `Valid` and the signer certificate should show your
verified name.

---

## macOS — Developer ID + notarization

Prepped in the workflow (the `APPLE_*` env vars); activates when the secrets
exist. Requires a Mac for the certificate export.

### One-time setup (at a Mac)

1. **Create the certificate** (skip if you already have one):
   Xcode → Settings → Accounts → your Apple ID → Manage Certificates →
   **+** → **Developer ID Application**. (Or via
   <https://developer.apple.com/account/resources/certificates>.)

2. **Export it**: Keychain Access → My Certificates → right-click
   *Developer ID Application: Your Name (TEAMID)* → Export → `.p12` format,
   set an export password.

3. **Base64 it** for GitHub:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

4. **App-specific password** for notarization:
   <https://account.apple.com> → Sign-In and Security →
   App-Specific Passwords → generate one named e.g. `docmd-notarize`.

5. **Set the secrets**:
   ```bash
   gh secret set APPLE_CERTIFICATE            # paste the base64 from step 3
   gh secret set APPLE_CERTIFICATE_PASSWORD   # the .p12 export password
   gh secret set APPLE_SIGNING_IDENTITY       # "Developer ID Application: Your Name (TEAMID)"
   gh secret set APPLE_ID                     # your Apple ID email
   gh secret set APPLE_PASSWORD               # the app-specific password
   gh secret set APPLE_TEAM_ID                # 10-char team ID from developer.apple.com
   ```

The next tagged release will produce a signed, notarized `.dmg` — no more
right-click-Open dance for macOS users.

---

## Current status

Tracked in [issue #43](https://github.com/paperhurts/doc-md/issues/43).

| Platform | Workflow | Credentials |
|---|---|---|
| Windows | ✅ wired | ⏳ awaiting Azure setup above |
| macOS | ✅ wired | ⏳ awaiting cert export (needs a Mac) |
| Linux | n/a | package managers / AppImage don't use Authenticode-style signing |
