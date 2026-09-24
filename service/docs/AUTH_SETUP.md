# 모집공고자 이메일 인증 설정

Supabase 프로젝트: `leadyo-map` (`bfjhdjjjczxmlkrodlgp`). 앱은 `signInWithOtp`로 가입과 로그인을 시작하고, 사용자가 입력한 인증번호를 `verifyOtp`로 확인합니다. 새 이메일도 가입할 수 있으며 이메일 확인은 필수입니다.

## Supabase 대시보드 설정

1. [Email Templates](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/templates)에서 **Magic Link / OTP** 템플릿의 본문을 [`../supabase/templates/otp.html`](../supabase/templates/otp.html) 내용으로 설정합니다. 제목은 `리드요 로그인 인증번호`로 설정합니다. `{{ .Token }}`이 있어야 6자리 코드가 메일에 들어갑니다.
2. 같은 화면의 **Confirm signup** 템플릿에도 같은 본문을 적용하고 제목을 `리드요 이메일 인증번호`로 설정합니다.
3. [URL Configuration](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/url-configuration)에서 개발 테스트 중 Site URL을 `http://127.0.0.1:3100`으로 둡니다. 실제 배포 주소가 정해지면 운영 URL을 등록하고 Site URL을 운영 주소로 바꿉니다.
4. [Providers / Email](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/providers)에서 이메일 제공자와 가입 허용, 이메일 확인이 켜져 있는지 확인합니다.

현재 공개 Auth 설정에서는 이메일 제공자와 가입 허용이 켜져 있고 자동 확인은 꺼져 있습니다. 공개 설정만으로 원격 이메일 템플릿 본문과 SMTP 발송 상태는 확인할 수 없습니다.

Supabase 기본 메일 발송은 프로젝트 팀 구성원 주소로 제한됩니다. 첫 흐름 검증은 해당 주소로 진행하고, 일반 모집공고자에게 열기 전에 [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)를 설정합니다. SMTP 계정 비밀번호는 저장소에 넣지 않습니다.

## 검증 순서

1. 본인 소유 테스트 이메일로 `/login`에서 인증번호를 요청합니다.
2. 메일에 6자리 코드가 도착하는지 확인하고 `/login`에 입력합니다.
3. `/account`로 이동하는지 확인합니다. 이용약관·개인정보 처리 안내 URL과 `LEGAL_VERSION`이 확정되기 전에는 모집공고자 정보 저장이 비활성화됩니다.
4. 모집공고자 정보 저장 후 `/manage`에서 공고 등록·수정·종료를 확인합니다. 실제 아파트 현장을 운영자가 등록해야 공고를 만들 수 있습니다.

프로젝트 설정의 `[auth.email.template.confirmation]`과 `[auth.email.template.magic_link]`은 **로컬 Supabase CLI 설정**입니다. GitHub 연결만으로 호스팅 프로젝트의 이메일 템플릿이 자동 변경되지는 않습니다.
