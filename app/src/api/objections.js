import api from "./client";
import { getApiErrorMessage } from "../shared/api/errors/apiError";
import { canObject, isOpenObjection } from "../features/payments/model/paymentHistory";
const pendingPayments = new Set();
export async function listPaymentObjections(paymentId, userId) {
 const matched=[];
 for(let page=1;page<=100;page++) {
  const {data}=await api.get("all_requests/user/requests/",{params:{page,page_size:100,request_type:"support"}});
  const rows=Array.isArray(data) ? data : data?.results || [];
  matched.push(...rows.filter(row => String(row.user)===String(userId) && row.user_input_data?.objection_type === "payment"
   && String(row.user_input_data?.payment_id)===String(paymentId)));
  if(Array.isArray(data) || !data.next) return matched;
 }
 throw new Error("تعذر التحقق من سجل الاعتراضات. أعد المحاولة لاحقاً.");
}
export async function submitPaymentObjection(item, reason, userId) {
 const clean=String(reason || "").trim();
 if(!clean || clean.length>1000) return {ok:false,error:"يرجى كتابة سبب الاعتراض (حتى 1000 حرف)."};
 if(!canObject(item) || !userId || (item.user != null && String(item.user)!==String(userId))) return {ok:false,error:"الاعتراض غير متاح لهذه العملية."};
 const key=`${userId}:${item.id}`;
 if(pendingPayments.has(key)) return {ok:false,error:"طلب الاعتراض قيد الإرسال."};
 pendingPayments.add(key);
 try {
  const detail = await api.get(`payment/payment/${item.id}/`);
  const verified = detail.data;
  if (!verified || String(verified.id) !== String(item.id) || String(verified.user) !== String(userId) || !canObject(verified)) {
    return {ok:false,error:"تعذر التحقق من ملكية العملية أو أنها غير متاحة للاعتراض."};
  }
  const existing=await listPaymentObjections(item.id,userId);
  const open=existing.find(isOpenObjection);
  if(open) return {ok:true,data:open,existing:true};
  const {data}=await api.post("all_requests/user/requests/",{
   request_type:"support",status:"objection",title:`Payment objection #${item.id}`,description:clean,
   user_input_data:{objection_type:"payment",source:"mobile_app",payment_id:item.id,transaction_id:item.transaction_id ?? null}
  });
  return {ok:true,data};
 } catch(error) {return {ok:false,error:getApiErrorMessage(error)};}
 finally {pendingPayments.delete(key);}
}
