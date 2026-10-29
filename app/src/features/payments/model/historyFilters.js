// Calendar dates are selected in local controls; ledger timestamps use Django's Asia/Damascus day.
export const HISTORY_TIME_ZONE = "Asia/Damascus";
export function calendarKey(date) {
 if (!date) return "";
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function ledgerDay(value) {
 if (!value) return "";
 const date = new Date(value);
 if (Number.isNaN(+date)) return "";
 return new Intl.DateTimeFormat("en-CA", {timeZone:HISTORY_TIME_ZONE, year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
export function historyToday(now = new Date()) {
 const [y,m,d] = ledgerDay(now).split("-").map(Number);
 return new Date(y,m-1,d);
}
export function presetRange(preset, now = new Date(), year, month) {
 const today = historyToday(now); let from = new Date(today), to = new Date(today);
 if (preset === "all") return [null,null];
 if (preset === "week") from.setDate(from.getDate() - (from.getDay()+6)%7);
 if (preset === "month") from.setDate(1);
 if (preset === "previousMonth") {from = new Date(today.getFullYear(),today.getMonth()-1,1); to = new Date(today.getFullYear(),today.getMonth(),0);}
 if (preset === "selectedMonth") {from = new Date(year,month,1); to = new Date(year,month+1,0); if (to>today) to=today;}
 return [from,to];
}
export function historyStatus(item) {
 const status=String(item?.status || "pending").toLowerCase();
 if (["success","successful","completed","paid","approved"].includes(status)) return "approved";
 if (["failed","rejected","declined","error"].includes(status)) return "failed";
 if (["canceled","cancelled"].includes(status)) return "cancelled";
 if (["processing","in_progress"].includes(status)) return "processing";
 return status;
}
export function filterHistory(items, params) {
 return items.filter(item => {
  const day = ledgerDay(item.created_at || item.created || item.date);
  return (!params.date_from || day && day>=params.date_from) && (!params.date_to || day && day<=params.date_to);
 });
}
export function historySummary(items) {
 return { total:items.length, success:items.filter(x=>historyStatus(x)==="approved").length,
 pending:items.filter(x=>historyStatus(x)==="pending").length,
 failed:items.filter(x=>historyStatus(x)==="failed").length };
}

export function matchesHistoryStatus(item, filter) {
 return historyStatus(item) === filter;
}
