import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SERVICES} from '../scripts/state.mjs';
test('paused email keeps health results and pending records without SMTP, warnings or test delivery',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hiyo-mail-paused-'));
 try{
  for(const dir of ['scripts','history','public','node_modules/nodemailer'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['snapshot.mjs','state.mjs'])await fs.copyFile(new URL('../scripts/'+name,import.meta.url),path.join(root,'scripts',name));
  await fs.writeFile(path.join(root,'node_modules/nodemailer/package.json'),JSON.stringify({type:'module',exports:'./index.js'}));
  await fs.writeFile(path.join(root,'node_modules/nodemailer/index.js'),"export default {createTransport(){throw Error('SMTP must never be called while paused');}};");
  const now=Date.now();for(const service of SERVICES)await fs.writeFile(path.join(root,'history',service.slug+'.yml'),`status: up\nresponseTime: 20\nlastUpdated: ${new Date(now).toISOString()}\n`);
  const pending={id:'existing-alert',slug:'hiyo-app',kind:'down',at:now,attempts:2};
  await fs.writeFile(path.join(root,'history/notification-state.json'),JSON.stringify({last:Object.fromEntries(SERVICES.map(x=>[x.slug,'up'])),pending:[pending],mailDay:new Date(now).toISOString().slice(0,10),mailCount:2}));
  for(const flag of ['false','']){
   const result=spawnSync(process.execPath,['scripts/snapshot.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,EMAIL_ENABLED:flag,TEST_EMAIL:'true',SMTP_USER:'fixture@example.test',SMTP_PASSWORD:'fixture',ALERT_TO:'fixture@example.test'}});
   assert.equal(result.status,0,result.stderr);assert(!result.stdout.includes('::warning::'));
   const status=JSON.parse(await fs.readFile(path.join(root,'public/status.json'),'utf8'));assert.equal(status.email.enabled,false);assert.equal(status.email.error,null);assert.equal(status.services.length,5);
   const state=JSON.parse(await fs.readFile(path.join(root,'history/notification-state.json'),'utf8'));assert.deepEqual(state.pending,[pending]);assert.equal(state.mailCount,2);
  }
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('hiyo-mail-paused-'));await fs.rm(root,{recursive:true,force:true});}
});

test('SMTP failure remains visible at the daily cap and clears only after an accepted retry',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hiyo-mail-paused-'));
 try{
  for(const dir of ['scripts','history','public','node_modules/nodemailer'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['snapshot.mjs','state.mjs'])await fs.copyFile(new URL('../scripts/'+name,import.meta.url),path.join(root,'scripts',name));
  await fs.writeFile(path.join(root,'node_modules/nodemailer/package.json'),JSON.stringify({type:'module',exports:'./index.js'}));
  await fs.writeFile(path.join(root,'node_modules/nodemailer/index.js'),"export default {createTransport(){return {close(){},async sendMail(){if(process.env.SMTP_MODE==='ok')return {accepted:['fixture']};throw Object.assign(Error('private account/password'),{code:'EAUTH',responseCode:535});}}}};");
  const now=Date.now();for(const service of SERVICES)await fs.writeFile(path.join(root,'history',service.slug+'.yml'),`status: up\nresponseTime: 20\nlastUpdated: ${new Date(now).toISOString()}\n`);
  const statePath=path.join(root,'history/notification-state.json'),statusPath=path.join(root,'public/status.json');
  const read=async path=>JSON.parse(await fs.readFile(path,'utf8'));
  await fs.writeFile(statePath,JSON.stringify({last:Object.fromEntries(SERVICES.map(x=>[x.slug,'up'])),pending:[{id:'alert',slug:'hiyo-app',kind:'down',at:now,attempts:19}],mailDay:new Date(now).toISOString().slice(0,10),mailCount:19}));
  const snapshot=(mode='fail')=>spawnSync(process.execPath,['scripts/snapshot.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,EMAIL_ENABLED:'true',TEST_EMAIL:'false',SMTP_MODE:mode,SMTP_USER:'fixture@example.test',SMTP_PASSWORD:'fixture',ALERT_TO:'fixture@example.test'}});
  assert.equal(snapshot().status,1);let status=(await read(statusPath)).email;assert.equal(status.status,'rate_limited');assert.equal(status.error,'SMTP_DELIVERY_FAILED:EAUTH:535');assert(status.nextAttemptAt);assert(!JSON.stringify(status).includes('private account'));
  const failure=status.lastFailure;assert.equal(snapshot().status,0);status=(await read(statusPath)).email;assert.deepEqual(status.lastFailure,failure);assert.equal(status.error,failure.error);
  const state=await read(statePath);state.mailDay='2000-01-01';await fs.writeFile(statePath,JSON.stringify(state));
  assert.equal(snapshot('ok').status,0);status=(await read(statusPath)).email;assert.equal(status.status,'accepted');assert.equal(status.error,null);assert.equal(status.lastFailure,null);assert.equal(status.pending,0);
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('hiyo-mail-paused-'));await fs.rm(root,{recursive:true,force:true});}
});
