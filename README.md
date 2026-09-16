# HIYO Mainnet Status

[운영 상태 대시보드](https://seodongkon84-oss.github.io/hiyo-mainnet-status/) · [감시 실행](../../actions)

HIYO Mainnet 공개 건강 확인 주소를 Upptime v1.44.0으로 약 5분마다 검사합니다. 기본 동작은 실패 시 재시도 후 장애·지연을 기록하고 GitHub 이슈를 생성하며, 복구하면 닫습니다. GitHub 예약 실행 지연이 있을 수 있습니다.

이 저장소에는 공개 상태 확인 설정·HTTP 응답 상태·메일 전달 상태만 있습니다. HIYO 앱 소스·계정 사용량·API 키는 포함하지 않습니다. 공급자 사용량은 대시보드의 공식 Cloudflare/Vercel 버튼에서 로그인 후 확인합니다. Sites가 소유한 자원은 개인 Cloudflare 사용량에 포함되지 않을 수 있습니다.

## 이메일 연결

수신/발신 주소는 `HIYO_ALERT_EMAIL` 비밀 설정에 보관합니다. SMTP 서버: `smtp.naver.com:465`, 인증서 검증을 유지한 TLS.

1. 네이버에서 SMTP 이용과 2단계 인증을 설정하고 앱 비밀번호를 발급합니다. [공식 안내](https://help.naver.com/service/30029/contents/21341?lang=ko&osType=PC).
2. 이 저장소 **Settings → Secrets and variables → Actions → New repository secret**에 `HIYO_SMTP_PASSWORD`와 `HIYO_ALERT_EMAIL`을 등록합니다. 비밀번호와 개인 이메일을 이슈·소스·채팅에 적지 않습니다.
3. **Actions → HIYO external monitoring → Run workflow → test_email 체크**로 연결 확인 메일을 보냅니다. 실제 받은편지함 도착도 확인합니다.

비밀번호가 없어도 상태 검사는 실행합니다. 대시보드는 이메일 연결 대기를 표시합니다. 장애/복구 변화마다 큐에 넣고 전송 실패 시 다음 검사에서 재시도합니다. 하루 최대 20회 SMTP 전송 시도, 회차당 3건, 큐 50건/7일 보관입니다. 초과 미발송은 숨기지 않고 개수로 표시합니다. 전송 후 기록 저장 전에 실행이 중단되면 중복 메일이 가능하며, 실제 받은편지함 도착을 보장하지 않습니다.

## 비용과 권한

공개 저장소의 표준 GitHub 호스팅 Linux runner와 GitHub Pages를 사용합니다. 별도 유료 서버나 공급자 요금제 변경이 없습니다. 비공개 전환·대형 runner 전환 전에는 요금을 확인해야 합니다. 실행마다 제공되는 GITHUB_TOKEN만 사용하며, 장기 GH_PAT는 필요하지 않습니다. Upptime에는 이메일 비밀값을 전달하지 않고 전용 발송 단계만 읽습니다.

Upptime 원본 템플릿의 자동 갱신/사이트 빌드 workflow는 사용하지 않습니다. 이 저장소의 최소 workflow를 유지하며, action은 commit SHA로 고정합니다. 업데이트는 버전을 검토하고 테스트 후 반영합니다. MIT 원저작권은 LICENSE에 보존합니다.

## 검증·한계

`npm ci && npm test`는 중복 경보/복구/큐 한도/결과 시각 검사를 수행합니다. HTTP 건강 응답은 로그인·실결제·실통화·WebSocket 송수신·정산 작업 완료 증거가 아닙니다. 감시기가 멈춘 경우 대시보드는 20분 후 검사 지연으로 표시하지만, 멈춘 감시기 자체의 이메일 발송은 불가능합니다. GitHub Actions 실패 알림도 계정 설정에서 켜 두세요.
