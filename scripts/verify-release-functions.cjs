'use strict';
const {GoogleAuth}=require('../functions/node_modules/google-auth-library');
const targets={
  'us-central1':['assertMemberPhoneAvailable','completeMemberRegistration','preparePlayPurchase','verifyPlayPurchase','reconcilePlayPurchases'],
  'europe-west1':['indexMemberPhone'],
  'us-east1':['playBillingNotifications']
};
async function main(){
 const client=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 for(const [region,names] of Object.entries(targets))for(const name of names){
  const {data}=await client.request({url:`https://cloudfunctions.googleapis.com/v2/projects/eldalel-elshamel/locations/${region}/functions/${name}`});
  if(data.state!=='ACTIVE'||data.buildConfig?.entryPoint!==name)throw Error(`Function not active: ${name}`);
  console.log('ACTIVE',name,region);
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
