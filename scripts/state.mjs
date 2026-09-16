export const SERVICES = [
  {slug:'hiyo-app',name:'HIYO app',description:'Vercel · app readiness'},
  {slug:'hiyo-backend',name:'HIYO backend',description:'Sites · app and database readiness'},
  {slug:'hiyo-chat',name:'HIYO chat',description:'Cloudflare · chat Worker HTTP health'},
  {slug:'hiyo-operations',name:'HIYO operations',description:'Cloudflare · operations Worker HTTP health'},
];
export function parseHistory(text, now = Date.now()) {
  const read = key => text.match(new RegExp('^'+key+':\\s*(.+)$','m'))?.[1].trim().replace(/^['"]|['"]$/g,'');
  const time = Date.parse(read('lastUpdated'));
  const status = read('status');
  if (!Number.isFinite(time) || time > now+60000 || now-time > 15*60000 || !['up','down','degraded'].includes(status)) {
    throw new Error('Missing or stale Upptime result');
  }
  const response = Number(read('responseTime'));
  return {status,checkedAt:new Date(time).toISOString(),responseTime:Number.isFinite(response)?response:null};
}
export function transition(previous, results, now) {
  const state = structuredClone(previous ?? {last:{},pending:[],delivered:0});
  state.last ??= {}; state.pending ??= [];
  for (const item of results) {
    const prior = state.last[item.slug];
    if (item.status !== prior && (prior || item.status !== 'up')) {
      const kind = item.status==='up' ? 'recovered' : item.status;
      state.pending.push({id:item.slug+':'+now+':'+kind,slug:item.slug,name:item.name,kind,at:now,attempts:0});
    }
    state.last[item.slug] = item.status;
  }
  // Bound the queue, but never silently report complete delivery when entries expire.
  const valid = state.pending.filter(x => now-x.at <= 7*86400000);
  state.dropped = (state.dropped??0) + state.pending.length-valid.length + Math.max(0,valid.length-50);
  state.pending = valid.slice(-50);
  return state;
}
