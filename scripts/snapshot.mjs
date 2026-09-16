import fs from 'node:fs/promises';
import nodemailer from 'nodemailer';
import {SERVICES,parseHistory,transition} from './state.mjs';
const now=Date.now();
const path='history/notification-state.json';
const previous=await fs.readFile(path,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const results=await Promise.all(SERVICES.map(async service=>({...service,...parseHistory(await fs.readFile(`history/${service.slug}.yml`,'utf8'),now)})));
const state=transition(previous,results,now);
const configured=!!(process.env.SMTP_PASSWORD && process.env.SMTP_USER && process.env.ALERT_TO);
if(process.env.TEST_EMAIL==='true') {
  if(!configured)throw new Error('HIYO_SMTP_PASSWORD and HIYO_ALERT_EMAIL must be added in GitHub Actions secrets before the email test.');
  state.pending.push({id:'test:'+now,slug:'email',name:'HIYO Mainnet',kind:'test',at:now,attempts:0});
}
let mailError=null;
const day=new Date(now).toISOString().slice(0,10);
if(state.mailDay!==day){state.mailDay=day;state.mailCount=0;}
if(configured && state.pending.length && state.mailCount<20) {
  const transport=nodemailer.createTransport({host:'smtp.naver.com',port:465,secure:true,
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},
    connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,
    tls:{minVersion:'TLSv1.2'},disableFileAccess:true,disableUrlAccess:true});
  try {
    for(const item of [...state.pending].slice(0,Math.min(3,20-state.mailCount))) {
      item.attempts++; state.mailCount++;
      const labels={down:'응답 장애',degraded:'응답 지연',recovered:'정상 복구',test:'이메일 연결 확인'};
      try {
        const delivered=await transport.sendMail({from:process.env.SMTP_USER,to:process.env.ALERT_TO,
          messageId:`<${Buffer.from(item.id).toString('hex')}@hiyo-status.local>`,
          subject:`[HIYO Mainnet] ${item.name} · ${labels[item.kind]}`,
          text:`${item.name}: ${labels[item.kind]}\n발생 시각: ${new Date(item.at).toISOString()}\n최근 상태: ${state.last[item.slug]??'연결 확인'}\n\n대시보드: https://seodongkon84-oss.github.io/hiyo-mainnet-status/\n공개 주소 건강 검사 결과입니다. 로그인·실결제·실제 통화 검증은 포함하지 않습니다.\n기본 검사 간격은 5분이며 GitHub 실행 지연이 있을 수 있습니다.`});
        if(!delivered.accepted?.length)throw new Error('SMTP_RECIPIENT_NOT_ACCEPTED');
        state.pending=state.pending.filter(x=>x.id!==item.id);
        state.delivered=(state.delivered??0)+1;
        state.lastAcceptedAt=new Date().toISOString();
        if(item.kind==='test')state.testAcceptedAt=state.lastAcceptedAt;
      } catch {mailError='SMTP_DELIVERY_FAILED';break;}
    }
  }finally{transport.close();}
}
await fs.mkdir('history',{recursive:true});
await fs.writeFile(path,JSON.stringify(state,null,2)+'\n');
const snapshot={checkedAt:new Date(now).toISOString(),services:results,
  email:{configured,serverAcceptedAt:state.lastAcceptedAt??null,testAcceptedAt:state.testAcceptedAt??null,pending:state.pending.length,dropped:state.dropped??0,error:mailError}};
await fs.writeFile('public/status.json',JSON.stringify(snapshot,null,2)+'\n');
if(!configured)console.log('::warning::Email is awaiting HIYO_SMTP_PASSWORD and HIYO_ALERT_EMAIL. Availability checks remain active.');
if(mailError)throw new Error(mailError);
console.log(`Recorded ${results.length} public health checks; queued email: ${state.pending.length}.`);
