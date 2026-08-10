// ============================================================
// Cloud Functions — الدليل الشامل
// ============================================================
// الملف ده فيه فانكشنين:
// 1) resetMemberPassword — إعادة تعيين كلمة سر عضو نسي كلمة سره (الأدمن بس)
// 2) sendPushOnNotification — بترسل push notification فعلي لجهاز المستخدم لما
//    يتعمل إشعار جديد (رسالة، متابعة، تفعيل حساب...). من غيرها الإشعارات كانت
//    هتفضل تتسجل في قاعدة البيانات بس من غير ما توصل فعليًا لموبايل حد.
//
// ملحوظة: النسخة دي بصياغة firebase-functions v2 (النسخة اللي بتتثبت افتراضيًا
// دلوقتي مع npm install). لو الملف قبل كده كان بيديك خطأ "functions.firestore.document
// is not a function"، استبدله بالنسخة دي بالكامل.
//
// ═══════════ خطوات التركيب ═══════════
// 1. افتح functions/index.js في مجلد مشروعك وامسح كل محتواه
// 2. الصق مكانه كل كود الملف ده بالظبط
// 3. من مجلد المشروع الرئيسي (مش جوه functions):
//      firebase deploy --only functions
// ═══════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

// ─────────────────────────────────────────────
// 1) إعادة تعيين كلمة سر عضو (الأدمن بس)
// ─────────────────────────────────────────────
exports.resetMemberPassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "لازم تكون مسجل دخول");
  }

  const callerSnap = await admin.firestore().collection("members").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "الميزة دي للأدمن بس");
  }

  const { memberId, newPassword } = request.data || {};
  if (!memberId || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError("invalid-argument", "بيانات ناقصة أو كلمة السر أقل من 6 أرقام");
  }

  try {
    await admin.auth().updateUser(memberId, { password: String(newPassword) });
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", "فشل تغيير كلمة السر: " + e.message);
  }
});

// ─────────────────────────────────────────────
// 2) إرسال push notification فعلي لما يتعمل إشعار جديد
// بتشتغل تلقائي كل ما يتضاف مستند جديد في كولكشن notifications
// ─────────────────────────────────────────────
exports.sendPushOnNotification = onDocumentCreated("notifications/{notifId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const recipientId = data.recipientId;
  // إشعارات عامة من الأدمن (broadcast بدون recipientId محدد) مش بنبعتلها push دلوقتي
  if (!recipientId) return;

  const memberSnap = await admin.firestore().collection("members").doc(recipientId).get();
  if (!memberSnap.exists) return;
  const tokens = memberSnap.data().fcmTokens || [];
  if (!tokens.length) return;

  const message = {
    notification: {
      title: data.title || "الدليل الشامل",
      body: data.body || "",
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    // ننضف أي token بقى غير صالح (المستخدم مسح التطبيق أو مسح بيانات المتصفح)
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ].includes(r.error?.code)) {
        invalidTokens.push(tokens[idx]);
      }
    });
    if (invalidTokens.length) {
      await admin.firestore().collection("members").doc(recipientId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    }
  } catch (e) {
    console.error("sendPushOnNotification error:", e);
  }
});