import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistory,transition} from '../scripts/state.mjs';
const now=Date.parse('2026-09-16T15:00:00Z');
const result=status=>[{slug:'hiyo-app',name:'HIYO app',status}];
test('no first-run healthy email; one incident and recovery, no duplicate while unchanged',()=>{
  let s=transition(null,result('up'),now);assert.equal(s.pending.length,0);
  s=transition(s,result('down'),now+1);assert.equal(s.pending.length,1);
  s=transition(s,result('down'),now+2);assert.equal(s.pending.length,1);
  s=transition(s,result('up'),now+3);assert.deepEqual(s.pending.map(x=>x.kind),['down','recovered']);
});
test('initial downtime is queued; expired and overflowing queue is counted',()=>{
  const s=transition(null,result('down'),now);assert.equal(s.pending.length,1);
  s.pending.push(...Array.from({length:55},(_,i)=>({id:i,at:now})));
  const bounded=transition(s,result('down'),now+1);assert.equal(bounded.pending.length,50);assert.equal(bounded.dropped,6);
  assert.equal(transition(bounded,result('down'),now+8*86400000).dropped,56);
});
test('stale, future and malformed checks never become healthy',()=>{
  const yaml='status: up\nresponseTime: 123\nlastUpdated: 2026-09-16T15:00:00.000Z';
  assert.equal(parseHistory(yaml,now).responseTime,123);
  assert.throws(()=>parseHistory(yaml,now+16*60000));
  assert.throws(()=>parseHistory(yaml,now-120000));
  assert.throws(()=>parseHistory('status: up',now));
  assert.throws(()=>parseHistory(yaml.replace('up','unknown'),now));
});
