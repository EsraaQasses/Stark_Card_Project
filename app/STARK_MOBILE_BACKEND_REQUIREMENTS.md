# Stark Mobile — متطلبات Backend والتكامل

تاريخ المراجعة: 2026-10-30. تمت قراءة المشروع المحلي المستقل:
`C:/Users/alaan/Desktop/Stark/Stark_Card_Project-backend-v2/stark_backend`.
لم تُعدّل ملفاته أو قواعده الموجودة. العقود أدناه تفرّق بين الموجود والمقترح؛ أمثلة القيم اختبارية ولا تحتوي أسراراً.

## 1. سجل المدفوعات وإحصائيات الفترة — B-02/B-03

**الموجود:** `GET /api/payment/payment/` و`GET /api/payment/payment/stats/`.
`PaymentViewSet.get_queryset` يقيّد النتائج بمالكها لغير الأدمن، لكنه لا يطبّق `date_from/date_to/status`؛ `stats` يحسب كامل queryset.

**المطلوب:** تطبيق الفلاتر قبل التقسيم إلى صفحات على نفس queryset، مع ترتيب ثابت `-created_at,-id`، ومنطقة `Asia/Damascus`، وحدود اليوم شاملة من البداية وحصرية عند بداية اليوم التالي.

Request query:
```json
{"date_from":"2026-10-01","date_to":"2026-10-30","status":"success","page":1,"page_size":12,"timezone":"Asia/Damascus"}
```
Response 200:
```json
{"count":24,"next":"?page=2","previous":null,"results":[],"summary":{"total":36,"success":24,"pending":8,"failed":4},"filtering":{"applied":true,"timezone":"Asia/Damascus","date_field":"created_at"}}
```
`count` للنتائج بعد فلتر الحالة؛ summary للفترة نفسها قبل فلتر الحالة حتى تبقى أزرار الحالات قابلة للتنقل. يجب توثيق إدراج الملغاة والمستردة في كل عداد وعدم إخفاء حالات خارج التصنيف.

الصلاحيات: مستخدم/وكيل يرى مدفوعاته فقط؛ لا يقبل user_id لتجاوز الملكية. 400: `INVALID_DATE_RANGE`, `FUTURE_DATE`, `INVALID_STATUS`, `INVALID_TIMEZONE`؛ 401 جلسة غير صالحة؛ 403 صلاحية؛ 429 حد طلبات؛ 503 خدمة مؤقتة.

الاختبارات: منتصف الليل في دمشق مقابل UTC، فبراير الكبيس، عبور السنة، نهاية شهر حالي، ترتيب متعادل، summary مع جميع الصفحات، فلتر حالة مع التاريخ، منع تسريب بيانات حساب ثانٍ.

**حل التطبيق الحالي:** قراءة كل الصفحات المصرح بها عند وجود فلتر، حد أقصى 100 صفحة، تحقق count وعدم اكتمال السجل، ثم تصفية وتقسيم محليان. لا يستخدم Cache قديماً؛ يلغي الطلب السابق ويتجاهل استجاباته. هذه القراءة ليست snapshot ذرية؛ السجلات الكبيرة والمتغيرة تحتاج العقد السابق. لا يدّعي التطبيق أن Backend طبّق الفلاتر. إحصائية غير متوفرة لا تتحول إلى صفر.

## 2. لقطات الرصيد والمعرّفات — B-04/B-05

**الموجود:** PaymentSerializer يعيد `id`, `final_price`, `currency`, `external_transaction_id` وبيانات العملية، لكنه لا يعيد transaction_id أو balance snapshots. نموذج Transaction يحتوي balance_before وbalance_after؛ هذه الحقول وحدها ليست عقد snapshot ثابتاً، وقد تتغير balance_after أثناء التسوية.

**المطلوب:** توسيع `GET /api/payment/payment/{payment_id}/` والقائمة أو Endpoint تفاصيل مخصص بإسقاط مالي موثق، لا حقول user_inputs التي أرسلها الهاتف.

Response 200 المقترح:
```json
{"payment_id":101,"transaction_id":501,"external_transaction_id":"provider-ref","provider_order_id":"provider-order","status":"success","created_at":"2026-10-30T09:00:00+03:00","transaction":{"id":501,"wallet_currency":"USD","balance_before":"-2.00000000","balance_after":"-7.00000000","debited_amount":"5.00000000","balance_kind":"available","settlement_status":"posted","snapshot_immutable":true}}
```
nullable في العمليات القديمة؛ لا يُعاد صفر كبديل عن null. الاحتفاظ بلقطة الخصم الأصلية بعد الاسترداد؛ الاسترداد معاملة مستقلة. `payment_id` ليس `transaction_id`، و`reference/order_id` غير الموثّق لا يُعرض كمرجع مزود. مبالغ Decimal كنصوص، عملة كل لقطة صريحة USD/SYP، ودعم السالب عندما تسمح سياسة الخادم.

الصلاحيات: مالك العملية أو صلاحية أدمن محددة؛ 404 للمعرّف غير الموجود/غير المصرح، 401/403 حسب سياسة إخفاء الموارد. رموز: `PAYMENT_NOT_FOUND`, `SNAPSHOT_UNAVAILABLE` كبيانات عدم توفر لا نجاح مالي وهمي.
الاختبارات: null، صفر حقيقي، سالب، دقة تتجاوز JavaScript safe integer، معلقة، مستردة، وعملتان. التطبيق يعرض «غير متوفر» دون حساب محلي.

## 3. الاعتراضات — B-06/B-07

**الموجود:** `GET/POST /api/all_requests/user/requests/`، نوع support وحالة objection، وصف السبب وuser_input_data، admin_notes وrejection_reason. لا يوجد ارتباط FK إلزامي بالدفعة ولا قيد ذري يمنع اعتراضاً مكرراً. get_queryset للوكيل يختار طلبات عملائه بدلاً من طلباته الشخصية؛ يلزم فصل المسارين.

**عقد مقترح:**
- `POST /api/payment/payment/{payment_id}/objections/`
- `GET /api/payment/payment/{payment_id}/objections/`
- `GET /api/payment/objections/{id}/`

Request:
```json
{"reason":"خطأ","issue_key":"delivery","idempotency_key":"client-generated-key"}
```
Response 201:
```json
{"id":77,"payment_id":101,"status":"under_review","decision":null,"reason":"خطأ","admin_response":null,"rejection_reason":null,"decision_at":null,"created_at":"2026-10-30T09:00:00+03:00"}
```
Response existing 200 أو 409 مع `OPEN_OBJECTION_EXISTS` ومعرّف السجل القابل للقراءة.
400/422: `EMPTY_REASON`, `REASON_TOO_LONG`, `PAYMENT_NOT_ELIGIBLE`؛ 401 مصادقة؛ 404/403 ملكية. سبب كلمة واحدة مقبول، فراغ ممنوع، حد أعلى 1000. لم يوجد شرط min_length=5 في RequestSerializer/Request.description المقروء؛ يلزم إبقاء قاعدة الطول في العقد الجديد أيضاً.

الملكية تُستخرج من authenticated user والدفعة، ولا تُقبل من user_input_data. السماح بشراء مكتمل أو فاشل. uniqueness ذرية على العملية + المشكلة المفتوحة، مع تسلسل وtransaction لمنع السباق عبر جهازين. التطبيق يقرأ تفاصيل الدفعة للتحقق ويمنع التزامن داخل العملية، لكن ذلك لا يعوّض تحقق الخادم.

حالات القرار المطلوبة: under_review/accepted/rejected مع رد الإدارة وسبب الرفض وdecision_at. generic completed يعني إغلاق طلب؛ لا يكفي وحده لادعاء قبول الاعتراض، لذلك يظهر «مكتمل — قرار الاعتراض غير متوفر» دون قرار صريح.

الاختبارات: كلمة واحدة، whitespace، UTF-8، 1000/1001، ملكية مستخدم آخر، طلبان متزامنان، جهازان، وكيل يقرأ اعتراضه، قرار رفض مع سبب، قبول دون أي حركة مالية، مشكلة مختلفة على نفس العملية.
**قرار تجاري مطلوب:** هل يسمح بأكثر من مشكلة مفتوحة لكل دفعة؟ التطبيق الحالي يمنع أي اعتراض مفتوح إضافي لنفس الدفعة احتياطاً؛ العقد النهائي يجب أن يحدد issue_key.

## 4. الاسترداد الكامل/الجزئي — B-07

**الموجود:** payment.status/refunded_at/refunded_by، وخدمة FinanceService.refund كاملة؛ لا يوجد إسقاط جزئي مستقل موثّق للمستخدم. حالة الطلب المكتمل أو قرار الاعتراض لا تثبت تحويل المال.

**المطلوب:** `GET /api/payment/payment/{payment_id}/refunds/` أو حقل refund في تفاصيل الدفعة، قراءة فقط للتطبيق.
```json
{"refund":{"status":"partial","financial_status":"confirmed","original_amount":"10.00","refunded_amount":"4.00","remaining_refundable_amount":"6.00","currency":"USD","refunded_at":"2026-10-30T09:05:00+03:00","transaction_id":601,"decision_id":81}}
```
الحالات: none/no_refund/pending/partial/full/failed. partial/full لا تؤكد إلا بعد posted/confirmed لمعاملة فعلية. قرار no_refund ليس failed. مبلغ المتبقي يأتي من Backend دون طرح محلي. احتفظ بمعرّفات وحركة كل دفعة استرداد عند تعددها.
الصلاحيات: قراءة مالك العملية؛ قرار/تنفيذ للأدمن المخوّل في Backend فقط. 200 مع null للقديم؛ 401/404؛ 409 `REFUND_IN_PROGRESS`؛ 422 `INVALID_REFUND_AMOUNT` في واجهات الإدارة فقط؛ 503 تسوية مؤقتة.
الاختبارات: قبول اعتراض دون refund، جزئي ثم كامل، قيد التنفيذ، فشل، تعدد استردادات، عدم تجاوز الإجمالي، ثبات snapshot الأصلي. التطبيق أُعد لعرض الإسقاط السابق لكنه غير متصل بعقد غير موجود.

## 5. رفض الطلب وتسوية المال — B-08

**الموجود:** حالات rejected/failed/cancelled في سجلات الشحن والسحب والتحويل، دون إسقاط تسوية موحّد في كل الردود.
**المطلوب:** إضافة settlement إلى GET تفاصيل/قوائم shipping وtransactions ذات الصلة:
```json
{"status":"rejected","settlement":{"status":"released","confirmed":true,"amount":"5.00","currency":"USD","transaction_id":701,"settled_at":"2026-10-30T09:05:00+03:00"}}
```
status: released/not_debited/refund_pending/refunded/unknown. confirmed لا ينتج من rejected؛ يرتبط بحركة ledger موثقة. مبلغ/عملة الحركة اختياريان ويُعرضان فقط عند توفرهما. عدم توفر الإسقاط يبقي الرسالة «جارٍ التحقق من تسوية المبلغ».
200 قراءة؛ 401/404 ملكية؛ 409/503 لتسوية جارية. اختبارات: حجز تم تحريره، لم يُخصم، خصم يحتاج استرداداً، تسوية غير مؤكدة، فشل provider، إعادة محاولات قرار الإدارة. لا حركة مالية محلية.

## 6. استعلام الفاتورة — B-09

**الموجود:** `POST /api/store/user/products/{id}/query-wait/` وquery و`GET .../query-status/?local_id=...`؛ payload `{user_inputs:{...}}`. الردود لا تضمن expires_at أو invoice schema موحداً، ولا يربط عقد الشراء الحالي نتيجة الاستعلام بالطلب.

**المطلوب response 200:**
```json
{"query":{"local_id":"test-query","status":"success","expires_at":"2026-10-30T10:05:00+03:00","input_fingerprint":"server-hash","invoice":{"amount":"1000.00","currency":"SYP","status":"unpaid","period":"2026-10","reference":"invoice-ref"}}}
```
202 pending؛ 400 `INVALID_ACCOUNT`؛ 404 `INQUIRY_UNSUPPORTED`/غير موجود؛ 409 `INVOICE_ALREADY_PAID`؛ 422 `INQUIRY_EXPIRED`/`INQUIRY_INPUT_MISMATCH`؛ 503/504 timeout بلا نجاح وهمي. الصلاحيات مالك نتيجة الاستعلام والمستخدم المصادق؛ تمنع قراءة نتيجة مستخدم آخر.

شراء `POST /api/store/user/purchases/` يقبل inquiry_id/quote_id الموثّقين ويعيد التحقق من الحساب والمنتج والمبلغ والعملة والصلاحية ذرياً. النتيجة الجديدة لا تعني أن Backend يجيز شحن الرصيد من الهاتف. التطبيق يمنع الدفع لمنتج query_enabled عند عدم توفر نتيجة ناجحة وصلاحية صريحة. **هذا قيد فعلي حالياً للمنتجات التي لا تعيد expires_at، وليس تكاملاً مكتملاً.**

الاختبارات: اختلاف المدخلات، رد متأخر بعد تغيير الحساب، انتهاء الصلاحية أثناء شاشة التأكيد، غير مدعوم، pending/timeout، مبلغ وعملة حقيقيان، منع إعادة دفع فاتورة، ومنع تكرار إرسال مالي.

## 7. السعر حسب الفئة وتثبيت عرض السعر — B-10

**الموجود:** `GET /api/store/user/products/{id}/price_calculator/?amount=1&wallet_currency=USD` أو selected_option؛ يقرأ المستخدم وفئته في Backend. Product.price_info/user_final_prices وwallet_user_final_price. quote_id الموجود في بعض البيانات معرّف لسعر صرف وليس بالضرورة quote شراء مقفل.

**المطلوب:** price_quote_id + expires_at + product/customer category revision + amount/currency/requested selection، وتأكيد الذرية عند POST purchases:
```json
{"product_id":1,"wallet_currency":"USD","amount":"1","user_inputs":{},"price_quote_id":"price-quote","inquiry_id":null,"idempotency_key":"stable-operation-key"}
```
200 successful أو 202 pending مع معرّفات للعملية؛ 409 `PRICE_CHANGED`/`CATEGORY_CHANGED`/`QUOTE_EXPIRED`؛ 422 `INVALID_SELECTION`, `CURRENCY_MISMATCH`؛ 400 `INSUFFICIENT_FUNDS` عند رفض ledger؛ 401/403 ملكية/صلاحية.
الصلاحيات: category من المستخدم في الخادم، لا تقبل نسبة من Expo. المنتجات التاريخية تحتفظ بأسعارها. الاختبارات: تغيير الفئة بين فتح الشاشة والتأكيد، USD/SYP، تغير السعر أثناء نافذة التأكيد، غياب سعر العملة المطلوبة، نتيجة غير ناجحة تحمل message، رصيد سالب ضمن policy الخادم.
التطبيق يعيد جلب السعر عند التركيز وقبل التأكيد وبعده، ويطلب تأكيداً جديداً عند التغيّر؛ لا يضيف نسبة ربح محلية. لكنه لا يستطيع إزالة سباق تغيّر السعر بين آخر GET وPOST دون عقد quote ذري.

## 8. التحقق من نتيجة مالية غير مؤكدة — A-03/B-12

**الموجود:** POST purchases يقبل `Idempotency-Key` أو idempotency_key. يلزم توحيد العقد مع transfer/cashout/shipping، ولا يُفترض أن X-Idempotency-Key يعني الدعم في كل Endpoint.
**المقترح:** `GET /api/operations/by-idempotency-key/{key}/`، للمالك فقط، يعيد 200:
```json
{"operation_id":501,"status":"pending","financial_status":"unknown","payment_id":101,"transaction_id":501}
```
404 `OPERATION_NOT_FOUND` ليس إثباتاً للفشل قبل انقضاء نافذة معالجة موثقة؛ 409 `OPERATION_IN_PROGRESS`؛ 401/403، 503. لا retry مالي آلي. إعادة نفس key لنفس payload تعيد النتيجة نفسها؛ نفس key مع payload مختلف =409 `IDEMPOTENCY_CONFLICT`.
اختبارات: انقطاع بعد commit، timeout قبل الاستجابة، طلبان متزامنان، تبديل حساب، مرور التطبيق للخلفية، إعادة تشغيله، ومطابقة سجل العملية. الحماية الحالية في الذاكرة تمنع الطلب المطابق المجهول خلال جلسة التطبيق، ولا تعد ضماناً دائماً عبر الأجهزة أو إعادة التشغيل.

## 9. الجلسات والقفل والبيئة — B-11/B-12

اختُبرت شيفرة Django الحقيقية في SQLite :memory: مع حساب مستخدم ووكيل مؤقتين، JWT وملف المستخدم والسجل؛ النتائج في tests/local-backend-results.json. هذا ليس اختبار شبكة Expo إلى خادم 8000 أو اختبار جهاز.

إعداد التطبيق المحلي الموجود يشير إلى قاعدة API غير loopback؛ لم يُغيّر ولم يُستخدم لكتابة. لبيئة الجهاز يلزم EXPO_PUBLIC_API_BASE محلي واضح ومتاح للجهاز أو adb reverse وفق البيئة؛ لا عنوان LAN ثابت في الشيفرة. settings.py يفرض DJANGO_ENV ويدعم test/development، ALLOWED_HOSTS من البيئة، TIME_ZONE=Asia/Damascus، USE_TZ=True. لم تُعدّل إعدادات الإنتاج أو .env.

قفل التطبيق محلي بSecureStore على Android/iOS. عدم وجود بصمة يترك PIN بديلاً. فشل الشبكة لا يمسح بيانات الجلسة؛ الحذف لرفض مصادقة مؤكد. يلزم اختبار فعلي للـKeychain/Keystore والبصمة والاستعادة من الخلفية قبل الإغلاق النهائي. ملفات القفل الموجودة لم تُعدّل في هذه المهمة.
