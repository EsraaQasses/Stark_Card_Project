const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function loader(mocks = {}) {
 const cache = new Map();
 function load(relative) {
  let file = path.isAbsolute(relative) ? relative : path.resolve(root, relative);
  if (mocks[file]) return mocks[file];
  if (!path.extname(file)) file = ['.ts','.tsx','.js','/index.js'].map(ext=>file+ext).find(fs.existsSync);
  file = path.normalize(file);
  if (mocks[file]) return mocks[file];
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}}; cache.set(file,module);
  const source=fs.readFileSync(file,'utf8');
  const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const localRequire=name=> {
   if (mocks[name]) return mocks[name];
   if (name.startsWith('.')) return load(path.resolve(path.dirname(file),name));
   if (name !== "axios") throw new Error(`Unmocked package: ${name}`);
   return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date,Intl,Set,Map,Promise,AbortController,setTimeout,clearTimeout,__DEV__:false,process:{env:{EXPO_PUBLIC_API_BASE:'http://127.0.0.1:9/api'}}},{filename:file})(localRequire,module,module.exports);
  return module.exports;
 }
 return load;
}
const i18n={language:'ar'};
const i18nMock={[path.resolve(root,'src/i18n/index.js')]:i18n};
const pure=loader(i18nMock);
const errors=pure('src/shared/api/errors/apiError.ts');
const dates=pure('src/features/payments/model/historyFilters.js');
const history=pure('src/features/payments/model/paymentHistory.js');
const verify=pure('src/features/payments/model/paymentVerification.js');
for (const status of [400,401,403,404,409,422,429,500,503]) test(`localized HTTP ${status}`,()=>{
 const ar=errors.normalizeApiError({response:{status,data:{}}},'ar');
 const en=errors.normalizeApiError({response:{status,data:{}}},'en');
 assert.match(ar.message,/[\u0600-\u06ff]/); assert.match(en.message,/[a-z]/i); assert.equal(ar.status,status);
});
test('localized nested backend error and fields',()=>{
 const error=errors.normalizeApiError({response:{status:422,data:{error:{code:'INVALID_ACCOUNT',message:{ar:'رقم غير صالح',en:'Invalid account'},fields:{phone:['تحقق من الرقم']}}}}},'ar');
 assert.equal(error.message,'رقم غير صالح'); assert.equal(error.code,'INVALID_ACCOUNT'); assert.equal(error.fields.phone,'تحقق من الرقم');
});
test('DRF fields, arrays of objects and sensitive messages',()=>{
 assert.equal(errors.normalizeApiError({response:{status:400,data:{phone:['رقم غير صالح']}}},'ar').fields.phone,'رقم غير صالح');
 for(const value of ['AxiosError: bad','Traceback /home/app.py:12','Bearer sample','token=secret','<html>oops</html>',{foo:'bar'},[{foo:'bar'}]]) {
  const message=errors.getApiErrorMessage(value,'en'); assert.doesNotMatch(message,/AxiosError|Traceback|Bearer|secret|html|object Object/);
 }
});
test('network and timeout have stable localized copy',()=>{
 assert.match(errors.getApiErrorMessage({code:'ERR_NETWORK',message:'Network Error'},'en'),/connect/);
 assert.match(errors.getApiErrorMessage({code:'ECONNABORTED'},'en'),/timed out/);
});
test('financial unknown result for timeout and server errors, read failures stay retryable',()=>{
 for(const status of [undefined,500,503,408]) assert.equal(errors.normalizeApiError({config:{method:'post',url:'transactions/transfer/'},response:status ? {status,data:{}} : undefined},'en').outcomeUnknown,true);
 assert.equal(errors.normalizeApiError({config:{method:'get',url:'payment/payment/'},code:'ERR_NETWORK'},'en').outcomeUnknown,false);
 assert.equal(errors.normalizeApiError({config:{method:'post',url:'store/user/products/1/query-wait/'},code:'ERR_NETWORK'},'en').outcomeUnknown,false);
});
test('Damascus midnight boundary and leap-month/year ranges',()=>{
 assert.equal(dates.ledgerDay('2026-10-28T21:30:00Z'),'2026-10-29');
 const [from,to]=dates.presetRange('selectedMonth',new Date('2026-10-29T12:00:00Z'),2024,1);
 assert.equal(dates.calendarKey(from),'2024-02-01'); assert.equal(dates.calendarKey(to),'2024-02-29');
 const [previous,last]=dates.presetRange('previousMonth',new Date('2026-01-10T12:00:00Z'));
 assert.equal(dates.calendarKey(previous),'2025-12-01'); assert.equal(dates.calendarKey(last),'2025-12-31');
 const [,today]=dates.presetRange('month',new Date('2026-10-28T21:30:00Z')); assert.equal(dates.calendarKey(today),'2026-10-29');
});
test('all presets and timestamp filtering precede totals',()=>{
 const rows=[{created_at:'2026-10-28T21:30:00Z',status:'success'},{created_at:'2026-10-28T19:00:00Z',status:'failed'}];
 assert.equal(dates.filterHistory(rows,{date_from:'2026-10-29',date_to:'2026-10-29'}).length,1);
 for(const preset of ['today','week','month','previousMonth']) {const [a,b]=dates.presetRange(preset,new Date('2026-10-29T12:00Z')); assert(a<=b);}
 assert.equal(dates.presetRange('all')[0],null);
});
test('USD/SYP snapshots preserve negative/zero and never trust user input or current balance',()=>{
 assert.match(history.moneySnapshot('-12.5','USD','en'),/-12.50 USD/);
 assert.match(history.moneySnapshot(0,'SYP','en'),/0.00 SYP/);
 assert.equal(history.moneySnapshot(null,'USD','en'),'Unavailable');
 const row=history.paymentSnapshots({currency:'USD',current_balance:99,user_inputs:{wallet_balance_before:100}});
 assert.equal(row.before,null);assert.equal(row.after,null);
});
test('transaction, payment, provider and order identifiers never fall back into each other',()=>{
 const ids=history.paymentIdentifiers({id:10,transaction_id:20,external_transaction_id:'EXT',provider_order_id:'ORD',reference:'other'});
 assert.equal(ids.transaction,20);assert.equal(ids.payment,10);assert.equal(ids.provider,'EXT');assert.equal(ids.order,'ORD');
 assert.equal(history.paymentIdentifiers({id:10,reference:'internal',order_id:'internal-order'}).provider,null);
 assert.equal(history.paymentIdentifiers({id:10,order_id:'internal-order'}).order,null);
});
test('objection and refund states are separate; partial/full require confirmed finance',()=>{
 assert.equal(history.objectionStatus({status:'accepted'},'en'),'Accepted');
 assert.equal(history.refundPresentation({status:'refunded'},'en').status,'Unavailable');
 assert.equal(history.refundPresentation({refund:{status:'partial',financial_status:'pending',refunded_amount:4}},'en').status,'Refund processing');
 const refund=history.refundPresentation({refund:{status:'full',financial_status:'confirmed',refunded_amount:12,currency:'USD'}},'en');
 assert.equal(refund.status,'Fully refunded');assert.equal(refund.refunded,12);
 assert.equal(history.canObject({id:1,status:'pending'}),false);assert.equal(history.canObject({id:1,status:'failed'}),true);
});
test('rejection alone cannot claim funds returned',()=>{
 assert.match(history.rejectedSettlement({status:'rejected'},'en'),/being verified/);
 assert.match(history.rejectedSettlement({settlement:{confirmed:true,status:'released'}},'en'),/released/);
 assert.match(history.rejectedSettlement({settlement:{confirmed:true,status:'not_debited'}},'en'),/No amount/);
});
test('invoice must be successful, unexpired, and bound to same account inputs',()=>{
 const result={status:'success',expires_at:'2026-10-29T12:01:00Z'}; const now=Date.parse('2026-10-29T12:00:00Z');
 assert.equal(verify.inquiryIsPayable(result,'a','a',now),true);
 assert.equal(verify.inquiryIsPayable(result,'a','b',now),false);
 assert.equal(verify.inquiryIsPayable(result,'a','a',now+120000),false);
 assert.equal(verify.inquiryIsPayable({status:'success'},'a','a',now),false);
 assert.equal(verify.inquiryIsPayable({...result,status:'failed'},'a','a',now),false);
});
test('server category prices keep currency and reject absent/invalid quotes',()=>{
 assert.equal(verify.calculatorTotal({wallet_currency:'USD',wallet_user_final_price:'5'},'USD'),5);
 assert.equal(verify.calculatorTotal({currency:'USD',user_final_price:5},'SYP'),null);
 assert.equal(verify.calculatorTotal({wallet_currency:'SYP',wallet_user_final_price:null},'SYP'),null);
});
function services(mockApi) {
 return loader({...i18nMock,[path.resolve(root,'src/api/client.js')]:{__esModule:true,default:mockApi,buildUrl:(...parts)=>parts.join('/'),STORE_PREFIX:'/store'},
 '@react-native-async-storage/async-storage':{getItem:async()=>null},
 [path.resolve(root,'src/utils/walletHelpers.js')]:{setDefaultWalletId:()=>{},getDefaultWalletId:async()=>null}});
}
test('history filters complete pages before pagination and ignores stale cache',async()=>{
 let calls=0;
 const load=services({get:async(url,{params})=> {calls++; return {data:params.page===1 ? {results:[{id:1,status:'failed',created_at:'2026-09-01T12:00Z'}],next:'next'} : {results:[{id:2,status:'success',created_at:'2026-10-29T12:00Z'},{id:3,status:'failed',created_at:'2026-10-29T12:00Z'}],next:null}};}});
 const api=load('src/api/payment.js');const result=await api.listPaymentsHistory({date_from:'2026-10-29',date_to:'2026-10-29',page:1,page_size:1});
 assert.equal(calls,2);assert.equal(result.summary.total,2);assert.equal(result.summary.success,1);assert.equal(result.summary.failed,1);assert.equal(result.data.length,1);assert.equal(result.pagination.next,true);
});
test('purchase sends supported idempotency key once; timeout is uncertain and text alone is not success',async()=>{
 let calls=0,headers;
 const api=services({post:async(url,payload,config)=>{calls++;headers=config.headers;throw {code:'ECONNABORTED',config:{method:'post',url}};}})('src/api/payment.js');
 const args={product_id:1,walletBalance:100,finalAmount:5,wallet_currency:'USD',currency:'USD',idempotencyKey:'test-key'};
 const result=await api.processCompletePayment(args); assert.equal(result.ok,false);assert.equal(result.outcomeUnknown,true);assert.equal(calls,1);assert.equal(headers['Idempotency-Key'],'test-key');
 const textOnly=services({post:async()=>({data:{message:'received'}})})('src/api/payment.js'); assert.equal((await textOnly.processCompletePayment(args)).ok,false);
});
test('one-word objection accepted, whitespace rejected, duplicate open request not posted',async()=>{
 let posts=0;const row={id:1,user:7,status:'success'};
 const api=services({get:async url=>({data:url.startsWith('payment/')?row:[]}),post:async(url,payload)=>{posts++;return {data:{id:55,...payload}};}})('src/api/objections.js');
 assert.equal((await api.submitPaymentObjection(row,'خطأ',7)).ok,true);assert.equal(posts,1);
 assert.equal((await api.submitPaymentObjection(row,'  ',7)).ok,false);assert.equal(posts,1);
 assert.equal((await api.submitPaymentObjection(row,'خطأ',8)).ok,false);
 const duplicate=services({get:async url=>({data:url.startsWith('payment/')?row:[{id:55,user:7,status:'objection',user_input_data:{objection_type:'payment',payment_id:1}}]}),post:async()=>{throw Error('must not post');}})('src/api/objections.js');
 assert.equal((await duplicate.submitPaymentObjection(row,'خطأ',7)).existing,true);
});
test('double objection submit has a synchronous guard',async()=>{
 let release;const ready=new Promise(r=>release=r);let posts=0;
 const api=services({get:async url=>{await ready;return {data:url.startsWith('payment/')?{id:1,user:7,status:'failed'}:[]};},post:async()=>{posts++;return {data:{id:1}};}})('src/api/objections.js');
 const first=api.submitPaymentObjection({id:1,user:7,status:'failed'},'خطأ',7);
 assert.equal((await api.submitPaymentObjection({id:1,user:7,status:'failed'},'خطأ',7)).ok,false);release();await first;assert.equal(posts,1);
});
test('PIN rate limits, account isolation and Arabic digits (pure existing policy)',()=>{
 const policy=pure('src/features/app-lock/model/appLockPolicy.ts');
 const identity=pure('src/features/app-lock/model/accountIdentity.ts');
 assert.equal(policy.normalizePin('١٢٣٤٥٦'),'123456');assert.equal(policy.isValidPin('123456'),true);
 let state=policy.resetRateLimit();for(let n=0;n<5;n++) state=policy.recordFailedAttempt(state,1000+n);
 assert(state.lockedUntil>1004);assert.equal(policy.recordFailedAttempt(state,1005).failedAttempts,5);
 assert.notEqual(identity.getAppLockAccountId({id:1}),identity.getAppLockAccountId({id:2}));assert.equal(identity.getAppLockAccountId(null),null);
});
test('only confirmed 401/403 invalidate a session',()=>{
 const policy=pure('src/shared/api/errors/sessionPolicy.ts');
 for(const status of [undefined,0,400,404,429,500,503]) assert.equal(policy.isDefinitiveAuthFailure({status}),false);
 for(const status of [401,403]) assert.equal(policy.isDefinitiveAuthFailure({status}),true);
});
// Native module dialogs are mocked: these exercise handlers, not an Android/iOS device.
function screenHarness(platform) {
 const states=[];let cursor=0;let dialog;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),memo:component=>component,
 useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
 useRef:initial=>{const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];},useMemo:f=>f(),useCallback:f=>f,useEffect:()=>{}};
 const rn={Platform:{OS:platform},StyleSheet:{create:s=>s,hairlineWidth:1},useWindowDimensions:()=>({width:320,height:568})};
 for(const key of ['ActivityIndicator','Alert','FlatList','Modal','Pressable','RefreshControl','Text','TextInput','View']) rn[key]=key==='Alert'?{alert:()=>{}}:key;
 const mocks={...i18nMock,react:{__esModule:true,default:React,...React},'react-native':rn,
 '@expo/vector-icons':{Ionicons:'Icon'},'@react-native-community/datetimepicker':{__esModule:true,default:'DateTimePicker',DateTimePickerAndroid:{open:value=>{dialog=value;}}},
 'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0,top:0})},'react-i18next':{useTranslation:()=>({t:(key,fallback)=>fallback||key,i18n:{language:'ar'}})},'expo-clipboard':{setStringAsync:async()=>{}}};
 for(const [file,value] of Object.entries({'src/context/AuthProvider.tsx':{useAuth:()=>({user:{id:7}})},'src/api/payment.js':{},'src/api/objections.js':{},'src/ui/PageLayout.js':{default:'PageLayout',__esModule:true},'src/ui/CornerSpinner.js':{default:'Spinner',__esModule:true},'src/shared/ui/layout/index.js':{AppHeader:'Header'}}))mocks[path.resolve(root,file)]=value;
 const Screen=loader(mocks)('src/screens/MyPayments.js').default;
 const render=()=>{cursor=0;return Screen({navigation:{navigate:()=>{}}});};
 const all=tree=>{if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(all);return [tree,...all(tree.props?.children)];};
 const button=(tree,text)=>all(tree).find(node=>node.type==='Pressable' && all(node).some(child=>child.type==='Text' && child.props.children.includes(text)));
 return {render,all,button,getDialog:()=>dialog};
}
for(const platform of ['android','ios']) test(`${platform} repeated date open/cancel/apply handlers, apply/clear and compact small-screen render`,()=>{
 const h=screenHarness(platform);let tree=h.render();
 for(let n=0;n<3;n++) {
  tree=h.render();let from=h.all(tree).find(node=>node.props?.title==='من تاريخ');assert(from);from.props.onPress();
  if(platform==='android') {
   const dialog=h.getDialog();dialog.onChange({type:'dismissed'},new Date());
   assert.equal(h.all(h.render()).find(node=>node.props?.title==='من تاريخ').props.value,null);
   dialog.onChange({type:'set'},new Date(2026,0,2));
   assert.equal(h.all(h.render()).find(node=>node.props?.title==='من تاريخ').props.value.getDate(),2);
   h.button(h.render(),'مسح الفلتر').props.onPress();
  } else {
   tree=h.render();assert(h.all(tree).some(node=>node.type==='Modal'));h.button(tree,'إلغاء').props.onPress();
   assert.equal(h.all(h.render()).find(node=>node.props?.title==='من تاريخ').props.value,null);
   h.all(h.render()).find(node=>node.props?.title==='من تاريخ').props.onPress();tree=h.render();
   h.all(tree).find(node=>node.type==='DateTimePicker').props.onChange({type:'set'},new Date(2026,0,2));h.button(h.render(),'تطبيق').props.onPress();
   assert.equal(h.all(h.render()).find(node=>node.props?.title==='من تاريخ').props.value.getDate(),2);
   h.button(h.render(),'مسح الفلتر').props.onPress();
  }
 }
 assert(h.button(h.render(),'تطبيق الفلتر'));assert(h.button(h.render(),'مسح الفلتر'));assert(!h.button(h.render(),'شهر وسنة'));
});
function clientHarness(refreshFailure) {
 const actualAxios=require('axios');let cleared=0,refreshCalls=0,notifications=0;
 const load=loader({...i18nMock,axios:{create:config=>actualAxios.create(config),post:async()=>{refreshCalls++;throw refreshFailure;}},
 [path.resolve(root,'src/shared/storage/authStorage.ts')]:{getAuthorizationToken:async()=> 'test-access',getRefreshToken:async()=> 'test-refresh',setAuthTokens:async()=>{},clearAuthTokens:async()=>{cleared++;}}});
 const client=load('src/api/client.js');client.subscribeAuthFailure(()=>notifications++);
 return {api:client.default,counts:()=>({cleared,refreshCalls,notifications})};
}
test('real Axios interceptors prevent simultaneous financial duplicates and unknown replays',async()=>{
 const h=clientHarness();let attempts=0,release;
 h.api.defaults.adapter=async config=>{attempts++;await new Promise(r=>release=r);throw Object.assign(new Error('Network Error'),{config,code:'ERR_NETWORK',isAxiosError:true});};
 const first=h.api.post('transactions/transfer/',{amount:'2',currency:'USD'});
 await new Promise(resolve=>setTimeout(resolve,0));
 await assert.rejects(h.api.post('transactions/transfer/',{amount:'2',currency:'USD'}));assert.equal(attempts,1);
 release();await assert.rejects(first,error=>error.outcomeUnknown===true);
 await assert.rejects(h.api.post('transactions/transfer/',{amount:'2',currency:'USD'}));assert.equal(attempts,1);
 assert.equal(h.counts().cleared,0);
});
test('refresh timeout preserves credentials; definitive rejection clears them',async()=>{
 for(const status of [undefined,503,401,403]) {
  const failure=Object.assign(new Error('refresh failed'),{response:status?{status,data:{}}:undefined,config:{url:'/users/token/refresh/',method:'post'},code:status?undefined:'ERR_NETWORK'});
  const h=clientHarness(failure);
  h.api.defaults.adapter=async config=>{throw Object.assign(new Error('Unauthorized'),{config,response:{status:401,data:{}}});};
  await assert.rejects(h.api.get('users/me/'));
  assert.equal(h.counts().refreshCalls,1);assert.equal(h.counts().cleared,[401,403].includes(status)?1:0);
 }
});
test('read failures can be retried without financial replay or logout',async()=>{
 const h=clientHarness();let attempts=0;
 h.api.defaults.adapter=async config=>{attempts++;throw Object.assign(new Error('Network Error'),{config,code:'ERR_NETWORK',isAxiosError:true});};
 await assert.rejects(h.api.get('payment/payment/'));await assert.rejects(h.api.get('payment/payment/'));
 assert.equal(attempts,2);assert.equal(h.counts().cleared,0);
});
test('negative available balance is sent for backend overdraft decision, not locally rejected',async()=>{
 let called=0;const api=services({post:async()=>{called++;return {data:{success:true,transaction_id:42}};}})('src/api/payment.js');
 const result=await api.processCompletePayment({product_id:1,walletBalance:-2,finalAmount:1,wallet_currency:'USD',currency:'USD'});
 assert.equal(called,1);assert.equal(result.ok,true);
});
test('stored PIN is salted and hashed; changing account or PIN fails verification',async()=>{
 const crypto=require('node:crypto'),store=new Map();
 const load=loader({...i18nMock,'expo-crypto':{CryptoDigestAlgorithm:{SHA512:'sha512'},digestStringAsync:async(algorithm,value)=>crypto.createHash(algorithm).update(value).digest('hex'),getRandomBytesAsync:async count=>crypto.randomBytes(count)},
 [path.resolve(root,'src/shared/storage/secureStorage.ts')]:{getSecureItem:async key=>store.get(key)??null,setSecureItem:async(key,value)=>store.set(key,value),removeSecureItem:async key=>store.delete(key)}});
 const api=load('src/features/app-lock/storage/appLockStorage.ts');const record=await api.createAppLockRecord('id:1','123456',false);
 assert.equal(record.pinHash.length,128);assert.equal(record.salt.length,32);assert.equal(JSON.stringify([...store.values()]).includes('123456'),false);
 assert.equal(await api.verifyAppLockPin('id:1','123456',record),true);assert.equal(await api.verifyAppLockPin('id:2','123456',record),false);
 assert.equal(await api.verifyAppLockPin('id:1','000000',record),false);assert.equal((await api.loadAppLockRecord('id:2')).status,'missing');
});
test('AuthProvider boot keeps cached user on localized offline/503 failures',async()=>{
 for(const status of [undefined,503]) {
  const states=[],effects=[];let cursor=0,cleared=0;
  const React={createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props,children}),useContext:()=>null,
   useState:initial=>{const index=cursor++;states[index]=initial;return [initial,value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},
   useCallback:f=>f,useMemo:f=>f(),useEffect:f=>effects.push(f)};
  const authStorage={getAccessToken:async()=> 'test-access',getUserSession:async()=>({id:7,name:'Test'}),clearAuthStorage:async()=>{cleared++;},getRefreshToken:async()=> 'test-refresh'};
  const load=loader({...i18nMock,react:{__esModule:true,default:React,...React},
   [path.resolve(root,'src/shared/storage/authStorage.ts')]:authStorage,
   [path.resolve(root,'src/api/client.js')]:{subscribeAuthFailure:()=>()=>{}},
   [path.resolve(root,'src/api/auth.js')]:{apiLogout:async()=>{}},
   [path.resolve(root,'src/features/auth/api/authApi.ts')]:{refreshTokenNormalized:async()=>({ok:false,error:{status,message:'تعذر الاتصال'}})},
   [path.resolve(root,'src/features/profile/api/profileApi.ts')]:{getCurrentUserNormalized:async()=>({ok:false,error:{status,message:'تعذر الاتصال'}})}});
  load('src/context/AuthProvider.tsx').default({children:null});effects.forEach(effect=>effect());
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(cleared,0);assert.equal(states[1].id,7);assert.equal(states[0],false);
 }
});
function lockHarness({hardware=true,success=true}={}) {
 const slots=[],pending=[];let cursor=0,events={},authCalls=0,user={id:1},clearCalls=0;
 const same=(left,right)=>left && right && left.length===right.length && left.every((x,i)=>Object.is(x,right[i]));
 const React={createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props:{...props,children}}),useContext:()=>null,
  useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef:initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useMemo:(f,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:f(),deps};return slots[i].value;},
  useCallback:(f,deps)=>React.useMemo(()=>f,deps),
  useEffect:(f,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){slots[i]={deps};pending.push(f);}}};
 const load=loader({...i18nMock,react:{__esModule:true,default:React,...React},
 'expo-local-authentication':{AuthenticationType:{FACIAL_RECOGNITION:2,FINGERPRINT:1},hasHardwareAsync:async()=>hardware,isEnrolledAsync:async()=>hardware,supportedAuthenticationTypesAsync:async()=>hardware?[1]:[],authenticateAsync:async()=>{authCalls++;return {success};}},
 'react-native':{AppState:{currentState:'active',addEventListener:(name,callback)=>{events.change=callback;return {remove:()=>{}};}}},
 [path.resolve(root,'src/context/AuthProvider.tsx')]:{useAuth:()=>({user,booting:false,clearLocalSession:async()=>{clearCalls++;}})},
 [path.resolve(root,'src/features/app-lock/storage/appLockStorage.ts')]:{
  loadAppLockRecord:async()=>({status:'ready',record:{pinHash:'test-hash',salt:'test-salt',biometricsEnabled:true,failedAttempts:0,lockedUntil:0,lastFailureAt:0}}),
  verifyAppLockPin:async(account,pin)=>pin==='123456',saveAppLockRecord:async()=>{},removeAppLockRecord:async()=>{},createAppLockRecord:async()=>{throw Error('not enrolling');}}});
 const Provider=load('src/features/app-lock/context/AppLockProvider.tsx').default;
 const render=()=>{cursor=0;return Provider({children:null}).props.value;};
 const settle=async()=>{render();pending.splice(0).forEach(effect=>effect());await new Promise(resolve=>setTimeout(resolve,0));return render();};
 return {render,settle,background:()=>events.change('background'),switchUser:value=>{user=value;},counts:()=>({authCalls,clearCalls})};
}
test('AppLock provider keeps PIN fallback without biometric hardware and locks on background',async()=>{
 const h=lockHarness({hardware:false});let value=await h.settle();assert.equal(value.phase,'locked');assert.equal(value.biometricsAvailable,false);
 assert.equal(await value.unlockWithBiometrics(),false);assert.equal(h.counts().authCalls,0);
 assert.equal((await value.unlockWithPin('123456')).ok,true);assert.equal(h.render().phase,'unlocked');h.background();assert.equal(h.render().phase,'locked');
});
test('biometric cancellation keeps lock; successful mocked biometric opens it',async()=>{
 for(const success of [false,true]) {const h=lockHarness({success});const value=await h.settle();assert.equal(await value.unlockWithBiometrics(),success);assert.equal(h.render().phase,success?'unlocked':'locked');}
});
test('account switch and logout discard visible lock state without authenticating another account',async()=>{
 const h=lockHarness();let value=await h.settle();await value.unlockWithPin('123456');assert.equal(h.render().phase,'unlocked');
 h.switchUser({id:2});assert.equal(h.render().phase,'loading');value=await h.settle();assert.equal(value.phase,'locked');
 h.switchUser(null);value=await h.settle();assert.equal(value.phase,'disabled');
});
test('route prefills parse safely and exact decimal snapshots keep precision',()=>{
 assert.equal(verify.parseCheckoutObject('{"phone":"123"}').phone,'123');assert.equal(verify.parseCheckoutObject('[1]'),null);assert.equal(verify.parseCheckoutObject('bad json'),null);
 assert.equal(history.moneySnapshot('9007199254740993.12','USD','en'),'9,007,199,254,740,993.12 USD');
});
test('English backend validation is localized to Arabic without technical text',()=>{
 assert.match(errors.getApiErrorMessage({response:{status:400,data:{detail:'Invalid amount'}}},'ar'),/مبلغ/);
 assert.match(errors.normalizeApiError({response:{status:422,data:{fields:{phone:['This field is required.']}}}},'ar').fields.phone,/مطلوب/);
});
test('status filters keep processing/cancelled/refunded separate from the four cards',()=>{
 assert.equal(dates.matchesHistoryStatus({status:'processing'},'pending'),false);
 assert.equal(dates.matchesHistoryStatus({status:'cancelled'},'failed'),false);
 assert.equal(dates.matchesHistoryStatus({status:'refunded'},'approved'),false);
});
const checkoutRoute=pure('src/features/payments/model/checkoutRoute.js');
const productPricing=pure('src/features/payments/model/paymentPricing.js');
const requirementsModel=pure('src/features/payments/model/paymentRequirements.js');
test('store and favorite route the same internal product, never favorite/provider/store IDs',()=>{
 const product={id:42,store_product_id:701,external_product_info:{id:901},price:999};
 const store=checkoutRoute.buildCheckoutParams(product);
 const favorite=checkoutRoute.buildCheckoutParams(checkoutRoute.favoriteProductId({id:500,product}));
 assert.equal(JSON.stringify(store),JSON.stringify(favorite));assert.equal(store.product_id,'42');
 assert.equal(checkoutRoute.favoriteProductId({id:500,external_product_id:901}),null);
 assert.equal(checkoutRoute.checkoutProductId({store_product_id:701}),null);
 assert.equal(checkoutRoute.checkoutProductId({product_id:['42']}),'42');
 assert.equal(checkoutRoute.checkoutProductId({product_id:['42','43'],product:{id:99}}),null);
 assert.equal(checkoutRoute.checkoutProductId({product:'[object Object]'}),null);
});
test('prefill round trip preserves account/package/quantity and rejects stale prices/nonserializable data',()=>{
 const inputs={phone:'099',optional:null,missing:undefined,callback:()=>{},price:500,final_price:700};inputs.self=inputs;
 const params=checkoutRoute.buildCheckoutParams(42,{inputs,quantity:7,selected_option:'250',selected_id:3,unit_price_display:999});
 const init=checkoutRoute.checkoutInitialization(JSON.parse(JSON.stringify(params)));
 assert.equal(init.inputs.phone,'099');assert.equal(init.inputs.optional,null);assert.equal(init.quantity,7);assert.equal(init.selectedValue,'250');
 for(const key of ['price','final_price','callback','self','missing'])assert.equal(init.inputs[key],undefined);
 assert.equal(params.unit_price_display,undefined);
});
test('legacy object/JSON product routes stay compatible without trusting a route snapshot',()=>{
 assert.equal(checkoutRoute.checkoutProductId({product:JSON.stringify({id:42,name:'stale'})}),'42');
 assert.equal(checkoutRoute.checkoutProductId({product:{id:42}}),'42');
 assert.equal(checkoutRoute.checkoutProductId({product_id:'43',product:{id:42}}),'43');
 assert.equal(checkoutRoute.checkoutProductId({product_id:'undefined',product:{id:42}}),null);
});
const rawCheckoutProduct={id:42,store_product_id:701,name_ar:'المنتج الحالي',name_en:'Current product',description_ar:'وصف حالي',
 image:'/media/current.png',currency:'USD',is_active:true,product_type:'amount_based',min_amount:'2',max_amount:'10',base_price:'100',
 section:{id:3,name_ar:'القسم الحالي',name_en:'Current section'},
 requirements:[{id:1,field_name:'الهاتف',payload_key:'subscriber',field_type:'phone',is_required:true}]};
test('fresh product details match for store and serialized favorite after restart',async()=>{
 const calls=[];
 const api=services({get:async(url)=>{calls.push(url);return {data:url.includes('favorites')?{results:[{id:500,product:{id:42,name_ar:'قديم',price:1}}]}:rawCheckoutProduct};}})('src/api/store.js');
 const favorites=await api.listFavorites();assert.equal(favorites[0].id,500);assert.equal(favorites[0].product_id,'42');
 const restarted=JSON.parse(JSON.stringify(favorites[0]));
 const fromStore=await api.loadCheckoutProduct(checkoutRoute.checkoutProductId(checkoutRoute.buildCheckoutParams({id:42})));
 const fromFavorite=await api.loadCheckoutProduct(checkoutRoute.favoriteProductId(restarted));
 assert.equal(fromStore.product.id,42);assert.equal(fromFavorite.product.name,'المنتج الحالي');
 assert.equal(fromFavorite.product.description,fromStore.product.description);assert.equal(fromFavorite.requirements[0].payload_key,'subscriber');
 assert.equal(fromFavorite.product.store_product_id,701);assert(calls.filter(url=>url.includes('products/42/')).length===2);
});
test('deleted, disabled, mismatched and failed product loads never return card defaults',async()=>{
 for(const result of [{...rawCheckoutProduct,is_active:false},{...rawCheckoutProduct,id:99}]) {
  const api=services({get:async()=>({data:result})})('src/api/store.js');await assert.rejects(api.loadCheckoutProduct(42));
 }
 const api=services({get:async()=>{throw {response:{status:404,data:{}}};}})('src/api/store.js');await assert.rejects(api.loadCheckoutProduct(42));
});
test('numeric favorite.product is mapped as an internal ID without using favorite record ID',async()=>{
 const api=services({get:async()=>({data:[{id:999,product:42}]})})('src/api/store.js');const rows=await api.listFavorites();
 assert.equal(rows[0].id,999);assert.equal(rows[0].product.id,'42');
});
test('missing requirements are fetched from the chosen product endpoint; failure blocks checkout',async()=>{
 const called=[];const product={...rawCheckoutProduct,requirements:[]};
 const api=services({get:async url=>{called.push(url);return {data:url.includes('requirements')?[{field_name:'الحساب',payload_key:'account',is_required:true}]:product};}})('src/api/store.js');
 const result=await api.loadCheckoutProduct(42);assert.equal(result.requirements[0].payload_key,'account');assert(called[1].includes('/42/requirements/'));
 const broken=services({get:async url=>{if(url.includes('requirements'))throw Error('offline');return {data:product};}})('src/api/store.js');await assert.rejects(broken.loadCheckoutProduct(42));
});
test('packages survive without card prices; backend payload keys and dynamic select options survive',()=>{
 const pricing=productPricing.derivePricingFromProduct({id:42,product_type:'customization_based',customization_options:'100,250',currency:'USD'},'USD');
 assert.equal(pricing.mode,'packages');assert.equal(pricing.options.length,2);assert.equal(pricing.options[1].value,'250');assert.equal(pricing.options[1].amount,null);
 const fields=requirementsModel.normalizeProductRequirements({requirements:[{field_name:'الخطة',payload_key:'plan_key',options:['A','B']}]});
 assert.equal(fields[0].payload_key,'plan_key');assert.equal(fields[0].options.length,2);
});
test('edited dynamic inputs and current quantity override old prefill in purchase payload',()=>{
 const payload=pure('src/features/payments/model/paymentPayload.js').buildPaymentUserInputs({product:{id:42,name:'Current'},gamerId:'',
 requirementPayload:{values:{phone:'new'},_labels:{}},isRange:true,safeQty:2,isPackages:false,
 preUserInputs:{phone:'old',quantity:99,selected_option:'old'},total:5,walletCurrency:'USD'});
 assert.equal(payload.phone,'new');assert.equal(payload.quantity,2);assert.equal(payload.product_id,42);
});
test('list display never relabels provider cost or a USD price as an SYP sale price',()=>{
 const api=services({})('src/api/store.js');
 assert.equal(api.displayPrice({base_price:'2',currency:'USD'},'USD').amount,null);
 assert.equal(api.displayPrice({user_final_prices:{USD:5},currency:'USD'},'SYP').amount,null);
 assert.equal(api.displayPrice({user_final_prices:{SYP:5000}},'SYP').amount,5000);
});
function hookRuntime() {
 const slots=[],pending=[];let cursor=0,dirty=false,component;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),memo:f=>f,
 useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],next=>{const value=typeof next==='function'?next(slots[index]):next;if(!Object.is(value,slots[index]))dirty=true;slots[index]=value;}];},
 useRef:initial=>{const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
 useMemo:(f,deps)=>{const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:f()};return slots[index].value;},
 useCallback:(f,deps)=>React.useMemo(()=>f,deps),useEffect:(f,deps)=>{const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps)){const previous=slots[index];slots[index]={deps};pending.push(()=>{previous?.cleanup?.();slots[index].cleanup=f();});}}};
 const render=()=>{cursor=0;dirty=false;const output=component();pending.splice(0).forEach(effect=>effect());return output;};
 return {React,setComponent:value=>{component=value;},render,settle:async()=>{let output;for(let n=0;n<30;n++){output=render();await new Promise(r=>setTimeout(r,0));if(!dirty&&!pending.length)return output;}throw Error('Hook rendering did not settle');}};
}
test('checkout hook ignores old product responses and clears product on load failure/retry',async()=>{
 const runtime=hookRuntime();let id='1',resolveOld,failSecond=false;
 const load=loader({...i18nMock,react:{__esModule:true,default:runtime.React,...runtime.React},
 [path.resolve(root,'src/api/store.js')]:{loadCheckoutProduct:async productId=>{
  if(productId==='1')return new Promise(resolve=>resolveOld=resolve);
  if(failSecond)throw {code:'ERR_NETWORK',message:'Network Error'};
  return {product:{id:2,name:'Second'},requirements:[{payload_key:'second_account'}]};}}});
 const hook=load('src/features/payments/hooks/useCheckoutProduct.js').useCheckoutProduct;
 runtime.setComponent(()=>hook(id));runtime.render();id='2';assert.equal(runtime.render().product,null);
 let value=await runtime.settle();assert.equal(value.product.id,2);
 resolveOld({product:{id:1,name:'Old'},requirements:[]});await new Promise(r=>setTimeout(r,0));assert.equal(runtime.render().product.id,2);
 failSecond=true;value.retry();value=await runtime.settle();assert.equal(value.status,'error');assert.equal(value.product,null);
 failSecond=false;value.retry();value=await runtime.settle();assert.equal(value.product.id,2);
});
