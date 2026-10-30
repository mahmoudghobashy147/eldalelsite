package com.company.eldalelelshamel;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.*;

@CapacitorPlugin(name="PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
  private BillingClient client;
  private PluginCall purchaseCall;
  private final Set<String> products = new HashSet<>(Arrays.asList("eldalel_starter_annual","eldalel_basic_annual","eldalel_premium_annual","eldalel_vip_annual","eldalel_company_annual","eldalel_elite_annual"));
  @Override public void load() {
    client = BillingClient.newBuilder(getContext()).setListener(this)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
      .enableAutoServiceReconnection().build();
  }
  private boolean connecting=false;
  private final List<Runnable> queued=new ArrayList<>();
  private final List<PluginCall> waiting=new ArrayList<>();
  private void ready(PluginCall call, Runnable task) {
    getActivity().runOnUiThread(() -> {
      if(client.isReady()){task.run();return;}
      queued.add(task);waiting.add(call);
      if(connecting)return;
      connecting=true;
      client.startConnection(new BillingClientStateListener(){
        public void onBillingSetupFinished(BillingResult r){getActivity().runOnUiThread(()->{
          connecting=false;
          List<Runnable> tasks=new ArrayList<>(queued);List<PluginCall> calls=new ArrayList<>(waiting);queued.clear();waiting.clear();
          if(r.getResponseCode()==BillingClient.BillingResponseCode.OK)for(Runnable t:tasks)t.run();
          else for(PluginCall c:calls)c.reject("تعذر الاتصال بمتجر Google Play");
        });}
        public void onBillingServiceDisconnected(){}
      });
    });
  }
  private JSObject result(List<Purchase> purchases) {
    JSArray list = new JSArray();
    if(purchases != null) for(Purchase p:purchases) {
      JSObject item=new JSObject(); item.put("purchaseToken",p.getPurchaseToken());item.put("state",p.getPurchaseState());list.put(item);
    }
    JSObject out=new JSObject();out.put("purchases",list);return out;
  }
  @PluginMethod public void restore(PluginCall call) {
    ready(call,()-> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),(r,p)->{
      if(r.getResponseCode()==BillingClient.BillingResponseCode.OK) call.resolve(result(p)); else call.reject("تعذر استعادة المشتريات");
    }));
  }
  private void query(PluginCall call, boolean buy) {
    String id=call.getString("productId");
    if(!products.contains(id)) {call.reject("باقة غير معروفة");return;}
    ready(call,()->client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.SUBS).build())).build(),(r,details)->{
      if(r.getResponseCode()!=BillingClient.BillingResponseCode.OK || details.getProductDetailsList().isEmpty()){call.reject("الباقة غير متاحة في Google Play حاليًا");return;}
      ProductDetails d=details.getProductDetailsList().get(0);
      ProductDetails.SubscriptionOfferDetails offer=null;
      if(d.getSubscriptionOfferDetails()!=null) for(ProductDetails.SubscriptionOfferDetails o:d.getSubscriptionOfferDetails()) if("annual-prepaid".equals(o.getBasePlanId()) && o.getOfferId()==null) offer=o;
      if(offer==null){call.reject("الاشتراك السنوي غير متاح");return;}
      List<ProductDetails.PricingPhase> phases=offer.getPricingPhases().getPricingPhaseList();
      if(phases.size()!=1 || phases.get(0).getRecurrenceMode()!=3 || !"P1Y".equals(phases.get(0).getBillingPeriod())){call.reject("إعداد مدة الباقة غير صحيح");return;}
      if(!buy){
        JSObject out=new JSObject();out.put("price",phases.get(0).getFormattedPrice());call.resolve(out);return;
      }
      String account=call.getString("accountId");
      if(account==null || !account.matches("[a-f0-9]{64}")){call.reject("يلزم تأكيد الحساب");return;}
      if(purchaseCall!=null){call.reject("هناك عملية شراء مفتوحة");return;}
      BillingFlowParams params=BillingFlowParams.newBuilder().setObfuscatedAccountId(account).setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).setOfferToken(offer.getOfferToken()).build())).build();
      getActivity().runOnUiThread(()->{
        purchaseCall=call;
        BillingResult launched=client.launchBillingFlow(getActivity(),params);
        if(launched.getResponseCode()!=BillingClient.BillingResponseCode.OK){purchaseCall=null;call.reject("تعذر فتح الدفع؛ جرّب استعادة المشتريات");}
      });
    }));
  }
  @PluginMethod public void product(PluginCall call){query(call,false);}
  @PluginMethod public void buy(PluginCall call){query(call,true);}
  @Override public void onPurchasesUpdated(BillingResult r,List<Purchase> purchases){
    JSObject out=result(purchases);notifyListeners("purchasesUpdated",out);
    PluginCall call=purchaseCall;purchaseCall=null;
    if(call==null)return;
    if(r.getResponseCode()==BillingClient.BillingResponseCode.OK)call.resolve(out);
    else if(r.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED)call.reject("تم إلغاء الشراء","CANCELED");
    else call.reject("تعذر إتمام الشراء؛ استخدم استعادة المشتريات");
  }
  @Override protected void handleOnDestroy(){if(client!=null)client.endConnection();super.handleOnDestroy();}
}
