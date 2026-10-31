const fs=require('node:fs');
const dir='android/app/src/main/java/com/company/eldalelelshamel';
fs.mkdirSync(dir,{recursive:true});
fs.copyFileSync('native/play-billing/PlayBillingPlugin.java',`${dir}/PlayBillingPlugin.java`);
let s=fs.readFileSync(`${dir}/MainActivity.java`,'utf8');
if(!s.includes('registerPlugin(PlayBillingPlugin.class)'))s=s.replace(/public class MainActivity extends BridgeActivity\s*\{/,`public class MainActivity extends BridgeActivity {
  @Override public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(PlayBillingPlugin.class);
    super.onCreate(savedInstanceState);
  }
`);
if(!s.includes('registerPlugin(PlayBillingPlugin.class)'))throw Error('MainActivity anchor missing');
fs.writeFileSync(`${dir}/MainActivity.java`,s);
const gradle='android/app/build.gradle';s=fs.readFileSync(gradle,'utf8');
if(!s.includes('com.android.billingclient:billing:'))s+='\ndependencies { implementation "com.android.billingclient:billing:9.1.0" }\n';
fs.writeFileSync(gradle,s);
// Preserve the existing published Android 7+ device floor and avoid reusing version 5.
const variables='android/variables.gradle';
s=fs.readFileSync(variables,'utf8').replace(/(compileSdkVersion|targetSdkVersion)\s*=\s*(\d+)/g,(_,key,n)=>`${key} = ${Math.max(36,Number(n))}`).replace(/minSdkVersion\s*=\s*(\d+)/,(_,n)=>`minSdkVersion = ${Math.max(24,Number(n))}`);
fs.writeFileSync(variables,s);
s=fs.readFileSync(gradle,'utf8').replace(/versionCode\s+(\d+)/,(_,n)=>`versionCode ${Math.max(7,Number(n))}`).replace(/versionName\s+"1\.0"/,'versionName "2.1.7"');
fs.writeFileSync(gradle,s);

// Optional foreground location: no precise/background location or required GPS hardware.
const manifestPath='android/app/src/main/AndroidManifest.xml';
let manifest=fs.readFileSync(manifestPath,'utf8');
if(!manifest.includes('android.permission.ACCESS_COARSE_LOCATION'))manifest=manifest.replace('</manifest>','<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n<uses-feature android:name="android.hardware.location" android:required="false" />\n</manifest>');
fs.writeFileSync(manifestPath,manifest);
