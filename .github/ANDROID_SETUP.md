# Android CI Setup

Complete this one-time setup before Android builds will work in CI.

---

## Step 1: Run android init locally

```bash
npm run android:init
```

This generates `src-tauri/gen/android/`. Commit the entire folder:

```bash
git add src-tauri/gen/android/
git commit -m "chore: add Android Gradle project"
git push
```

---

## Step 2: Configure Android signing in Gradle

Edit `src-tauri/gen/android/app/build.gradle.kts` and add signing config.

Find the `android { }` block and add:

```kotlin
import java.util.Properties
import java.io.FileInputStream

// Load keystore.properties if it exists (set by CI or locally)
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config ...

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

Commit this change:

```bash
git add src-tauri/gen/android/app/build.gradle.kts
git commit -m "chore: add Android release signing config"
git push
```

---

## Step 3: Generate a signing keystore (one-time)

```bash
keytool -genkey -v \
  -keystore neurix-release.keystore \
  -alias neurix \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store this file somewhere safe (NOT in the repo).

---

## Step 4: Convert keystore to base64

**macOS/Linux:**
```bash
base64 -i neurix-release.keystore | pbcopy
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("neurix-release.keystore")) | Set-Clipboard
```

---

## Step 5: Add GitHub Secrets

Go to: **GitHub repo > Settings > Secrets and variables > Actions > New repository secret**

| Secret name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Base64 output from Step 4 |
| `ANDROID_KEY_ALIAS` | `neurix` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | Password you set for the key |
| `ANDROID_STORE_PASSWORD` | Password you set for the keystore |

---

## Step 6: Set workflow permissions

Go to: **GitHub repo > Settings > Actions > General > Workflow permissions**

Select: **Read and write permissions**

---

## Step 7: First push

```bash
git push origin main
```

The release workflow will:
1. See no tag exists for `v0.1.0`
2. Build Windows + Linux desktop installers
3. Build Android APK + AAB
4. Create a GitHub Release with all files attached

Every subsequent push auto-bumps: `0.1.0 → 0.1.1 → 0.1.2 → ...`

---

## Local keystore.properties (optional, for local signed builds)

Create `src-tauri/gen/android/keystore.properties` (already in `.gitignore`):

```properties
storeFile=neurix-release.keystore
storePassword=your_store_password
keyAlias=neurix
keyPassword=your_key_password
```

Copy your keystore file next to it:
```bash
cp /path/to/neurix-release.keystore src-tauri/gen/android/neurix-release.keystore
```

Then `npm run build:android` will produce a signed APK locally.
