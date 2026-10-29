const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root=path.resolve(__dirname,'..');
const roots=['src/screens','src/api','src/features','src/context','src/shared','src/ui','src/components','src/utils'];
const rows=[];
function scan(dir) {
 if(!fs.existsSync(dir))return;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,item.name);
  if(item.isDirectory()){scan(file);continue;}
  if(!/\.(js|jsx|ts|tsx)$/.test(file))continue;
  const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JSX);
  function visit(node) {
   let type;
   if(ts.isCatchClause(node))type='catch';
   else if(ts.isThrowStatement(node))type='throw';
   else if(ts.isCallExpression(node)) {
    const expression=node.expression.getText(ast);
    if(/Alert\.alert|Toast|set\w*Error$|normalizeApiError|getApiErrorMessage/.test(expression))type=expression;
   }
   else if(ts.isPropertyAccessExpression(node) && /(?:error|err|failure).*\.message|response\.data/i.test(node.getText(ast)))type='raw error access';
   if(type) {
    const line=ast.getLineAndCharacterOfPosition(node.getStart()).line+1;
    const excerpt=node.getText(ast).replace(/\s+/g,' ').slice(0,210);
    const filename=path.relative(root,file).replaceAll('\\','/');
    const method=/Alert/.test(type)?'Alert':/Toast/.test(type)?'Toast':/set.*Error/.test(type)?'Inline':'مصدر/معالج';
    const literalCodes=[...excerpt.matchAll(/\b(?:400|401|403|404|409|422|429|500|503)\b/g)].map(m=>m[0]);
    rows.push([`${filename}:${line}`,type,literalCodes.join(', ')||'يتحدد وقت الطلب / لا ينطبق',excerpt,
     type==='catch'?'إلغاء متوقع: صامت؛ فشل قراءة: رسالة وإعادة محاولة؛ كتابة مالية: تحقق من السجل':'normalizeApiError: لغة التطبيق + fields + رسالة آمنة بحسب HTTP/Backend code',
     method,/pay|transfer|cashout|shipping/i.test(filename)?'مراجعة السجل قبل تكرار كتابة؛ إعادة محاولة القراءة الآمنة':'تصحيح الحقل / إعادة محاولة القراءة']);
   }
   ts.forEachChild(node,visit);
  }
  visit(ast);
 }
}
roots.forEach(folder=>scan(path.join(root,folder)));
const escape=value=>String(value).replaceAll('|','\\|').replaceAll('`',"'").replaceAll('<','&lt;');
const header=`# جرد مواضع الأخطاء — 2026-10-30\n\nجرد آلي قابل لإعادة التوليد بواسطة \`node tests/generate-error-inventory.cjs\`. يشمل كل الملفات الحالية في الشاشات والخدمات والميزات والسياقات والمكونات المشتركة. كل صف موضع مصدر، وليس بالضرورة رسالة تظهر للمستخدم؛ catch والتسجيل والرسائل الديناميكية تحتاج سياق الدالة. عمود النص يعرض تعبير المصدر عندما لا يوجد نص ثابت. صفوف Alert قد تكون نجاحاً أو تأكيداً، ولا تُصنّف كأخطاء مؤكدة لمجرد وجودها.\n\nعدد المواضع: **${rows.length}**. التفاصيل التقنية لا تُعرض للمستخدم عبر معالج API المركزي. العبارات المحلية القديمة المضمّنة بالعربية لم تُترجم جميعها؛ هذا الجرد لا يدعي إغلاقها.\n\n| الشاشة/الملف والسطر | مصدر الخطأ/الموضع | HTTP/Backend code | النص أو التعبير الحالي | المعالجة/النص المقترح | العرض | إجراء المستخدم |\n|---|---|---|---|---|---|---|\n`;
fs.writeFileSync(path.join(root,'STARK_MOBILE_ERROR_INVENTORY.md'),header+rows.map(row=>'| '+row.map(escape).join(' | ')+' |').join('\n')+'\n');
console.log(`Inventoried ${rows.length} source locations in ${new Set(rows.map(row=>row[0].split(':')[0])).size} files.`);
