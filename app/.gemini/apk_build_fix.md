# خطوات بناء APK بعد إصلاح المشكلة

## 1. تنظيف الذاكرة المؤقتة
```bash
# تنظيف Metro bundler cache
npx expo start --clear

# تنظيف node_modules (إذا لزم الأمر)
rm -rf node_modules
npm install
```

## 2. بناء APK للمعاينة
```bash
# استخدم EAS Build للمعاينة
eas build --platform android --profile preview
```

## 3. بناء APK للإنتاج (اختياري)
```bash
eas build --platform android --profile production
```

## التغييرات المطبقة:

### ✅ app/_layout.tsx
- أضفنا SafeAreaProvider لحل مشكلة useSafeAreaInsets

### ✅ app.json
- أزلنا edgeToEdgeEnabled الذي كان يسبب تعارض مع Safe Area
- أضفنا softwareKeyboardLayoutMode: "pan"

### ✅ src/ui/Screen.js  
- أضفنا fallback protection لـ safe area insets

## ملاحظات مهمة:

1. **المشكلة كانت تظهر فقط في APK** وليس في التطوير لأن:
   - بناء الإنتاج أكثر صرامة في التعامل مع الأخطاء
   - edgeToEdgeEnabled كان يسبب تعارض في APK المبني

2. **الحل النهائي يجمع بين:**
   - إضافة SafeAreaProvider (أساسي)
   - تعديل إعدادات Android (تحسين)
   - Fallback protection (احتياطي)

3. **اختبار بعد البناء:**
   - جرب الانتقال من Extra إلى Verification
   - جرب فتح صفحة شحن الرصيد (NewDeposit)
   - تأكد من عمل جميع الصفحات بشكل صحيح

## الأوامر السريعة:

```bash
# بناء APK
eas build -p android --profile preview

# فحص حالة البناء
eas build:list

# تحميل APK بعد اكتمال البناء
# سيظهر لك رابط التحميل من EAS
```
