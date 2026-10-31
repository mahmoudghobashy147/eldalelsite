import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
export async function getApproximateNativeLocation(){
 if(!Capacitor.isNativePlatform())throw new Error('not-native');
 let permission=await Geolocation.checkPermissions();
 if(permission.coarseLocation!=='granted')permission=await Geolocation.requestPermissions({permissions:['coarseLocation']});
 if(permission.coarseLocation!=='granted')throw new Error('location-denied');
 return Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:20000,maximumAge:60000});
}
