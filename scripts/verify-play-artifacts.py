import hashlib,json,re,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'play-artifacts';out.mkdir(exist_ok=True)
apk=root/'android/app/build/outputs/apk/debug/app-debug.apk'
aab=root/'android/app/build/outputs/bundle/release/app-release.aab'
assert apk.is_file() and aab.is_file(),'Both Android build outputs are required'
import os
sdk=Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','/usr/local/lib/android/sdk')))
aapts=sorted((sdk/'build-tools').glob('*/aapt'))
assert aapts,'Android aapt is required to inspect the real APK manifest'
badging=subprocess.check_output([str(aapts[-1]),'dump','badging',str(apk)],text=True)
(out/'apk-manifest-summary.txt').write_text(badging)
package=re.search(r"package: name='([^']+)'",badging).group(1)
target=int(re.search(r"targetSdkVersion:'(\d+)'",badging).group(1))
assert package=='com.company.eldalelelshamel',package
assert target>=36,target
with zipfile.ZipFile(aab) as z:
 libs=[n for n in z.namelist() if n.endswith('.so')]
 assert not libs,'Shared libraries require an explicit 16 KB alignment verification before release'
 signed=any(re.match(r'META-INF/.*\.(RSA|DSA|EC)$',n,re.I) for n in z.namelist())
assert not signed,'This preparation build must not silently use a signing identity'
files={}
for p,name in [(apk,'eldalel-android16-test.apk'),(aab,'eldalel-android16-UNSIGNED-not-for-play-upload.aab')]:
 data=p.read_bytes();(out/name).write_bytes(data);files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
report={'status':'TEST_BUILD_ONLY','playSubmissionReady':False,'applicationId':package,'versionName':'1.0.0','versionCode':1,'targetSdk':target,'bundledSharedLibraries':libs,'bundleSigned':signed,'files':files,'unresolved':['Google Play developer account and identity verification','Upload key and signed AAB','Account deletion and associated-data fulfillment','In-app UGC reporting, blocking and moderation','Google Play billing decision for digital subscription features','Privacy policy, Data safety and app-access review','Production Firebase security remediation and real-device tests']}
(out/'build-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'applicationId':package,'targetSdk':target,'status':report['status'],'nativeLibraries':len(libs),'bundleSigned':signed}))
