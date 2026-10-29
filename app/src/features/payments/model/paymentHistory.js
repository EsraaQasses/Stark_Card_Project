// Only server-owned ledger fields belong here; never use user_inputs or current wallets.
export const missingValue = locale => String(locale).startsWith("ar") ? "غير متوفر" : "Unavailable";
export function moneySnapshot(value, currency, locale = "ar") {
 const text=String(value ?? "").trim();
 if (!/^-?\d+(?:\.\d+)?$/.test(text) || !["USD","SYP"].includes(currency)) return missingValue(locale);
 const ar=String(locale).startsWith("ar"), negative=text.startsWith("-");
 const [integer,fraction=""]=text.replace(/^-/,"").split(".");
 const whole=new Intl.NumberFormat(ar ? "ar-SY" : "en-US").format(BigInt(integer));
 const decimals=fraction.padEnd(2,"0").replace(/0+$/,"").padEnd(2,"0");
 const digits=ar ? decimals.replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]) : decimals;
 return `${negative ? "-" : ""}${whole}${ar ? "٫" : "."}${digits} ${currency}`;
}
export function paymentIdentifiers(item) {
 return { transaction:item?.transaction_id ?? item?.transaction?.id ?? null,
 payment:item?.payment_id ?? item?.id ?? null, provider:item?.external_transaction_id ?? null,
 order:item?.provider_order_id ?? (item?.order_id_source === "provider" ? item.order_id : null) };
}
export function paymentSnapshots(item) {
 // Current PaymentSerializer does not expose a linked transaction: old rows stay unavailable.
 const ledger = item?.transaction && typeof item.transaction === "object" ? item.transaction : item;
 return { before:ledger?.balance_before ?? null, after:ledger?.balance_after ?? null,
 currency:ledger?.wallet_currency || ledger?.currency || item?.currency,
 debit:ledger?.debited_amount ?? null };
}
export function canObject(item) {
 return Boolean(item?.id) && ["purchase",undefined,null,""].includes(item.transaction_type)
  && ["success","approved","completed","failed","rejected"].includes(String(item.status).toLowerCase());
}
export function isOpenObjection(request) {
 return !["completed","rejected","cancelled","closed","accepted"].includes(request?.status);
}
export function objectionStatus(request, locale = "ar") {
 const ar=String(locale).startsWith("ar");
 if (!request) return missingValue(locale);
 if (request.decision === "accepted" || request.status === "accepted") return ar ? "مقبول" : "Accepted";
 if (request.status === "completed") return ar ? "مكتمل — قرار الاعتراض غير متوفر" : "Closed — decision unavailable";
 if (request.status === "rejected") return ar ? "مرفوض" : "Rejected";
 return ar ? "قيد المراجعة" : "Under review";
}
export function refundPresentation(item, locale = "ar") {
 const refund=item?.refund;
 const ar=String(locale).startsWith("ar");
 // No inference from objection approval or payment.status. These require a dedicated server projection.
 const labels=ar ? {none:"لم يصدر قرار",no_refund:"بدون استرداد",pending:"استرداد قيد التنفيذ",partial:"مسترد جزئياً",full:"مسترد بالكامل",failed:"تعذر الاسترداد"}
 : {none:"No decision",no_refund:"No refund",pending:"Refund processing",partial:"Partially refunded",full:"Fully refunded",failed:"Refund failed"};
 if (!refund || typeof refund !== "object") return {status:missingValue(locale)};
 const confirmed=refund.financial_status === "confirmed";
 let status=refund.status;
 if (["partial","full"].includes(status) && !confirmed) status="pending";
 return { status:labels[status] || missingValue(locale), original:refund.original_amount,
 refunded:confirmed ? refund.refunded_amount : null, remaining:refund.remaining_refundable_amount,
 currency:refund.currency, date:confirmed ? refund.refunded_at : null, reference:confirmed ? refund.transaction_id : null };
}
export function rejectedSettlement(item, locale = "ar") {
 const ar=String(locale).startsWith("ar"), settlement=item?.settlement;
 if (settlement?.confirmed === true && settlement?.status === "released") return ar ? "تم رفض الطلب وإعادة المبلغ المحجوز إلى رصيدك المتاح." : "The request was rejected and the reserved amount was released to your available balance.";
 if (settlement?.confirmed === true && settlement?.status === "not_debited") return ar ? "تم رفض الطلب، ولم يتم خصم أي مبلغ من محفظتك." : "The request was rejected. No amount was deducted from your wallet.";
 return ar ? "تم رفض الطلب، وجارٍ التحقق من تسوية المبلغ." : "The request was rejected. Settlement is being verified.";
}
