import hashlib,json,re,subprocess,zipfile,struct,os
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'play-artifacts';out.mkdir(exist_ok=True)
apk=root/'android/app/build/outputs/apk/debug/app-debug.apk'
aab=root/'android/app/build/outputs/bundle/release/app-release.aab'
assert apk.is_file() and aab.is_file(),'Both Android build outputs are required'
sdk=Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','/usr/local/lib/android/sdk')))
aapts=sorted((sdk/'build-tools').glob('*/aapt'))
assert aapts,'Android aapt is required to inspect the real APK manifest'
badging=subprocess.check_output([str(aapts[-1]),'dump','badging',str(apk)],text=True)
(out/'apk-manifest-summary.txt').write_text(badging)
package=re.search(r"package: name='([^']+)'",badging).group(1)
target=int(re.search(r"targetSdkVersion:'(\d+)'",badging).group(1))
minimum=int(re.search(r"\nsdkVersion:'(\d+)'",badging).group(1))
version_code=int(re.search(r"versionCode='(\d+)'",badging).group(1))
version_name=re.search(r"versionName='([^']+)'",badging).group(1)
assert package=='com.company.eldalelelshamel',package
assert target>=36,target
assert minimum==24,minimum
assert version_code==1 and version_name=='1.0.0',(version_code,version_name)
# Check real ELF LOAD headers, rather than treating the presence of a .so as failure.
def elf_loads(data):
 assert data[:4]==b'\x7fELF','A shared object must be ELF'
 bits={1:32,2:64}[data[4]];endian={1:'<',2:'>'}[data[5]]
 read=lambda fmt,offset:struct.unpack_from(endian+fmt,data,offset)[0]
 phoff=read('Q',32) if bits==64 else read('I',28)
 size=read('H',54 if bits==64 else 42);count=read('H',56 if bits==64 else 44)
 loads=[]
 for i in range(count):
  offset=phoff+i*size
  if read('I',offset)!=1:continue
  align=read('Q' if bits==64 else 'I',offset+(48 if bits==64 else 28))
  address=read('Q' if bits==64 else 'I',offset+(16 if bits==64 else 8))
  file_offset=read('Q' if bits==64 else 'I',offset+(8 if bits==64 else 4))
  loads.append({'alignment':align,'addressOffsetCongruent16k':(address-file_offset)%16384==0})
 assert loads,'ELF must have at least one LOAD segment'
 return bits,loads
native=[]
with zipfile.ZipFile(aab) as z:
 libs=[n for n in z.namelist() if n.endswith('.so')]
 for name in libs:
  bits,loads=elf_loads(z.read(name));compatible=bits!=64 or all(p['alignment']>=16384 and p['addressOffsetCongruent16k'] for p in loads)
  native.append({'entry':name,'elfBits':bits,'loadSegments':loads,'compatible16k':compatible})
 print(json.dumps({'nativeAlignment':native}))
 assert all(n['compatible16k'] for n in native),'A bundled 64-bit native library is not 16 KB aligned'
 signed=any(re.match(r'META-INF/.*\.(RSA|DSA|EC)$',n,re.I) for n in z.namelist())
assert not signed,'This preparation build must not silently use a signing identity'
zipalign=Path(aapts[-1]).with_name('zipalign')
alignment=subprocess.run([str(zipalign),'-c','-P','16','-v','4',str(apk)],text=True,capture_output=True)
(out/'apk-zip-alignment.txt').write_text(alignment.stdout+alignment.stderr)
assert alignment.returncode==0,'APK failed zipalign -c -P 16 verification'
files={}
for p,name in [(apk,'eldalel-android16-test.apk'),(aab,'eldalel-android16-UNSIGNED-not-for-play-upload.aab')]:
 data=p.read_bytes();(out/name).write_bytes(data);files[name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
report={'status':'TEST_BUILD_ONLY','playSubmissionReady':False,'applicationId':package,'versionName':version_name,'versionCode':version_code,'targetSdk':target,'minimumSdk':minimum,'bundledSharedLibraries':libs,'nativeAlignmentDetails':native,'apkZipAlignment16k':True,'bundleSigned':signed,'permissions':re.findall(r"uses-permission: name='([^']+)'",badging),'files':files,'unresolved':['Google Play developer account and identity verification','Upload key and signed AAB','Account deletion and associated-data fulfillment','In-app UGC reporting, blocking and moderation','Google Play billing decision for digital subscription features','Privacy policy, Data safety and app-access review','Production Firebase security remediation and real-device tests']}
(out/'build-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'applicationId':package,'targetSdk':target,'status':report['status'],'nativeLibraries':len(libs),'native16kVerified':True,'bundleSigned':signed}))
