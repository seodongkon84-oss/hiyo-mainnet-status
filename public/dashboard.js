const source='https://raw.githubusercontent.com/seodongkon84-oss/hiyo-mainnet-status/master/public/status.json';
const labels={up:'정상 응답',down:'응답 장애',degraded:'응답 지연',stale:'검사 지연',unknown:'확인 불가'};
const $=id=>document.getElementById(id);
const local=iso=>new Date(iso).toLocaleString('ko-KR',{dateStyle:'medium',timeStyle:'short'});
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function fail(){
  $('overall').className='badge stale';$('overall').textContent='확인 불가';
  $('headline').textContent='최근 검사 결과를 확인할 수 없습니다.';
  $('freshness').textContent='연결을 확인한 뒤 다시 시도하거나 감시 실행 기록을 확인하세요.';
  $('services').replaceChildren(node('p','검사 결과를 가져오지 못했습니다.','service'));
  $('email').textContent='메일 연결 상태도 확인할 수 없습니다.';$('email-state').textContent='확인 불가';
}
async function refresh(){
  $('refresh').disabled=true;
  try {
    const response=await fetch(source+'?v='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('unavailable');
    const data=await response.json();const age=Date.now()-Date.parse(data.checkedAt);
    if(!Number.isFinite(age)||age < -60000||!Array.isArray(data.services)||data.services.length!==4)throw Error('invalid');
    const stale=age>20*60000;
    const valid=data.services.every(s=>['up','down','degraded'].includes(s.status));if(!valid)throw Error('invalid');
    const overall=stale?'stale':data.services.some(s=>s.status==='down')?'down':data.services.some(s=>s.status==='degraded')?'degraded':'up';
    $('overall').className='badge '+overall;$('overall').textContent=labels[overall];
    $('headline').textContent=overall==='up'?'네 곳 모두 정상 응답 중입니다.':overall==='stale'?'검사 결과가 오래되었습니다.':'확인이 필요한 서비스가 있습니다.';
    $('freshness').textContent='마지막 검사 '+local(data.checkedAt)+(stale?' · 20분 이상 갱신되지 않았습니다.':' · 공개 건강 확인 주소 기준');
    const cards=data.services.map(s=>{
      const row=node('article','', 'service');const info=node('div','');info.append(node('h3',s.name),node('p',s.description));
      const result=node('div','','service-result');result.append(node('span',Number.isFinite(s.responseTime)?s.responseTime.toLocaleString()+' ms':'응답 시간 없음','response'),node('span',labels[stale?'stale':s.status],'badge '+(stale?'stale':s.status)));
      row.append(info,result);return row;
    });$('services').replaceChildren(...cards);
    const mail=data.email??{};
    $('email-state').textContent=stale?'검사 지연':mail.error?'발송 재시도 대기':mail.configured?mail.testAcceptedAt?'발송 시험 수락':'시험 필요':'연결 대기';
    $('email').textContent=!mail.configured?'발송용 비밀 설정을 등록하면 장애·복구 이메일을 보낼 수 있습니다.':mail.error?'메일 발송에 실패했습니다. 다음 검사에서 재시도합니다.':mail.testAcceptedAt?'메일 서버가 연결 확인 메일을 수락했습니다. 받은편지함 확인이 필요합니다.':'발송 설정이 등록되었습니다. 연결 확인 메일을 시험해 주세요.';
    if(mail.pending)$('email').textContent+=' 대기 중 '+mail.pending+'건.';
    if(mail.dropped)$('email').textContent+=' 보관 한도·기간을 넘긴 미발송 '+mail.dropped+'건은 실행 기록을 확인하세요.';
  }catch{fail();}finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',refresh);refresh();
setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
