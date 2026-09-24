# Leadyo Map Service — 로컬 서비스 기반 v0.1

독립 모집공고자 가입 모델의 Next.js/TypeScript 프로젝트입니다. 실제 서비스 코드는 이 `service/` 폴더에 있으며, 저장소 루트의 `index.html`은 이전 정적 프로토타입입니다. 이 디렉터리에는 데모 계정·가상 공고·역할 선택·내부 문의함·브라우저 DB가 없습니다.

## 실행

Node.js 22 이상에서:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

기본 주소는 http://127.0.0.1:3100 입니다. 환경변수가 없으면 공고를 꾸며 표시하지 않고 연결 준비 상태를 보여줍니다. 이메일도 발송하지 않습니다.

## 이번 단계에서 구현한 것

- 비회원 지도 탐색 구조, 모집 대상/현장 검색, 모바일 전체 화면 현장 상세
- 네이버 Maps Web SDK 어댑터: 마커, 군집 확대, 키 미설정·스크립트 오류 상태
- Supabase 이메일 OTP 가입·로그인 코드, 쿠키 갱신, 서버 사용자 확인
- 최초 모집자 정보, 내 공고 등록·수정·종료·재게시 및 현장 등록 요청
- 전화 공개 동의, `tel:` 연락, 선택형 카카오 오픈채팅 링크 검증
- 운영자 공고 상태 변경, 회원 정지·해제, 현장 생성·수정 및 운영 기록 화면
- PostgreSQL 마이그레이션과 RLS, 소유권/숨김/정지/권한 상승 방지 테스트

## 외부 연결 순서

1. 독립 Supabase **테스트 프로젝트** 생성 후 URL와 publishable key를 `.env.local`에 입력합니다. 실제 운영 DB와 분리합니다. `service_role` 키는 이 앱에서 사용하지 않습니다.
2. `supabase/migrations/`의 SQL을 테스트 DB에 적용합니다. 로컬 테스트는 PGlite(PostgreSQL 엔진)로 검증했으며 실제 Supabase 전체 스택·Advisors 검사는 연결 후 진행해야 합니다.
3. Supabase Auth에서 이메일 확인을 활성화합니다. 가입 확인/매직링크 메일 모두 `supabase/templates/otp.html`의 `{{ .Token }}`으로 인증번호를 발송하도록 설정합니다. 운영 이메일은 별도 SMTP가 필요합니다. 발송 한도와 봇 방지 설정도 검증합니다.
4. 실제 이용약관·개인정보 처리 안내 URL과 `LEGAL_VERSION`을 설정합니다. 미설정 상태에서는 모집자 프로필 등록을 막습니다. 법적 문서는 임의로 작성하지 않았습니다.
5. 네이버 클라우드 **Maps** 상품에서 Web Dynamic Map 앱을 등록합니다. `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`에 앱 키를 입력하고 로컬/테스트/운영 도메인을 허용합니다. 서버용 Secret은 브라우저 환경변수에 넣지 않습니다.
6. 관리자도 먼저 실제 이메일로 가입하고 프로필을 만든 뒤, DB 소유자가 해당 UUID의 `private.member_access.role`만 `admin`으로 지정합니다. 사용자 메타데이터나 이메일 문자열로 관리자 권한을 부여하지 않습니다.
7. 테스트 계정 2개와 관리자로 실제 가입·메일 도착·공고 공개·연락·정지·새로고침을 검증합니다. 확인된 아파트 현장만 등록합니다.

## 데이터 구조

- `auth.users`: 이메일 인증 계정
- `profiles`: 모집자 이름·조직·연락처·약관 동의 기록 (본인/관리자만 조회)
- `private.member_access`: 역할·이용 상태 (클라이언트 직접 접근 금지)
- `projects`: 실제 아파트 현장·확인한 위치/상품정보
- `listings`: 소유자·현장·직급별 RT·조건·공개 연락처·상태
- `site_requests`: 현장 등록 요청
- `reports`: 신고 저장 구조 (공개 접수 API는 후속 구현)
- `audit_logs`: 공고/회원 운영 조치와 현장정보 변경 기록

소유자는 공고의 소유자/현장을 교체할 수 없고 운영 숨김 상태를 변경할 수 없습니다. 정지 회원의 공개 공고는 숨김 처리되며 정지 해제 후에도 비공개 상태를 유지합니다. 삭제는 소프트 삭제이며 일반 화면에서 제외됩니다. 역할·정지 상태를 JWT의 오래된 사용자 메타데이터에 의존하지 않고 DB에서 확인합니다.

## 검증

```sh
npm run typecheck
npm test
npm run build
```

`npm test`는 실제 PostgreSQL 엔진에서 anon/타 회원/소유자/관리자의 접근을 테스트합니다. Supabase Auth 실제 연동 검증은 연결 후 진행합니다. 네이버 지도는 로컬 Client ID 설정 후 데스크톱·모바일에서 SDK 인증과 지도 표시를 확인했습니다. 실제 현장 데이터의 마커·군집 검증은 연결 후 진행합니다.

## 출시 전 남은 범위

- 실제 Supabase RLS/Advisors, SMTP 도달, OTP 재시도·만료, 세션 만료 E2E
- 네이버 Maps 실 좌표·밀집 군집·최대 확대 QA, 서버 Geocoding 연결
- 비회원 신고 접수: CAPTCHA 검증 + DB 기반 요청 제한 후 서버 저장 (직접 anon INSERT는 차단)
- 현장 요청 처리 완료 동작/중복 요청 방지, 관리자 목록 페이지네이션·검색
- 개인정보 삭제/보유 정책·운영자 인증 강화·관측/백업/복구 및 연락 버튼 이벤트 집계
- 공개 약관과 개인정보 처리 안내 확정
- 현재 조회 상한(현장/공고 1,000건, 관리자 공고 200건)을 넘기기 전 영역별 조회/페이지네이션
- 실제 운영 배포 설정: Netlify base directory `service`, build `npm run build`. 현재 정적 사이트의 배포 설정은 변경하지 않았습니다.

## GitHub에서 새 웹 프로젝트 연결

- 저장소: `nij82/leadyo-map`
- 브랜치: `service-mvp`
- 루트/Base directory: `service`
- 프레임워크: Next.js
- 설치: `npm ci` / 빌드: `npm run build`
- 환경변수: `.env.example`의 항목을 호스팅 서비스에 별도로 입력합니다. `.env.local`은 Git에 포함하지 않습니다.

기존 정적 사이트의 `main` 브랜치 배포 설정은 유지합니다. Supabase 프로젝트 생성과 DB 마이그레이션 적용은 웹 호스팅의 GitHub 연결과 별도 작업입니다.
