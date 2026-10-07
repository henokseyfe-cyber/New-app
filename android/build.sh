#!/bin/bash
# Builds an APK without Gradle. Needs JAVA_HOME and ANDROID_HOME (platform 35, build-tools 35.0.0).
set -e
cd "$(dirname "$0")"
BT=$ANDROID_HOME/build-tools/35.0.0; JAR=$ANDROID_HOME/platforms/android-35/android.jar
rm -rf build && mkdir -p build/classes build/assets
cp ../public/* build/assets/
$BT/aapt2 link -o build/base.apk -I $JAR --manifest AndroidManifest.xml -A build/assets --java build/gen
javac --release 8 -classpath $JAR -d build/classes $(find src build/gen -name '*.java') 2>&1 | grep -v warning || true
$BT/d8 --lib $JAR --min-api 21 --output build $(find build/classes -name '*.class')
(cd build && zip -qj base.apk classes.dex)
$BT/zipalign -f 4 build/base.apk build/aligned.apk
[ -f debug.keystore ] || keytool -genkeypair -keystore debug.keystore -storepass android -keypass android -alias debug -keyalg RSA -validity 10000 -dname CN=Debug
$BT/apksigner sign --ks debug.keystore --ks-pass pass:android --out ../checkers.apk build/aligned.apk
echo Built ../checkers.apk
