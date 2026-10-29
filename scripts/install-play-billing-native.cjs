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
