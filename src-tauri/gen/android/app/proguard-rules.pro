# Neurix ProGuard Rules

# Keep all app classes
-keep class com.neurix.app.** { *; }
-keepclassmembers class com.neurix.app.** { *; }

# Keep Tauri framework classes (critical — IPC bridge will break without this)
-keep class app.tauri.** { *; }
-keep interface app.tauri.** { *; }

# Keep WebKit (used by Tauri webview)
-keep class androidx.webkit.** { *; }

# Keep native methods (JNI calls to Rust)
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep Parcelable
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Don't warn about missing classes from dependencies
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
