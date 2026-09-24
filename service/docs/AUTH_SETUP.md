# 모집공고자 이메일 링크 가입·로그인

Supabase 프로젝트: `leadyo-map` (`bfjhdjjjczxmlkrodlgp`). 앱은 이메일 주소로 `signInWithOtp`를 호출하고, 받은 메일의 기본 로그인 링크를 열어 가입 또는 로그인합니다. 기본 템플릿이 돌려주는 세션 토큰을 `/auth/confirm`의 브라우저 코드가 받아 세션 쿠키에 저장하고 `/account`로 이동합니다. 인증번호 입력과 메일 템플릿 수정은 사용하지 않습니다.

## Supabase 대시보드 설정

1. [URL Configuration](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/url-configuration)의 **Redirect URLs**에 `http://127.0.0.1:3100/auth/confirm`을 추가합니다. 테스트 단계의 **Site URL**은 `http://127.0.0.1:3100`으로 둡니다. 실제 배포 주소가 생기면 해당 주소의 `/auth/confirm`도 추가하고 Site URL을 운영 주소로 변경합니다.
2. [Providers / Email](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/providers)에서 이메일 가입과 이메일 확인이 켜져 있는지 확인합니다. 기존 공개 Auth 설정에서는 둘 다 사용 가능했고 자동 확인은 꺼져 있었습니다.
3. [Email Templates](https://supabase.com/dashboard/project/bfjhdjjjczxmlkrodlgp/auth/templates)는 기본 템플릿으로 둡니다. 2026-06-03 이후 생성된 Supabase Free 프로젝트는 기본 발송을 사용하는 동안 템플릿을 수정할 수 없으며, 이 앱은 기본 링크를 사용하도록 설계했습니다. [Supabase 변경 안내](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

## 발송 범위

Supabase 기본 메일은 **프로젝트 팀 구성원의 이메일 주소**에만 발송됩니다. 별도 도메인이나 Custom SMTP 없이 해당 주소로 내부 흐름을 시험할 수 있습니다. 일반 모집공고자가 가입하게 하려면 공개 전에 [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)를 설정해야 합니다.

## 검증 순서

1. Supabase 팀에 등록된 본인 이메일로 `/login`에서 링크를 요청합니다.
2. 메일의 링크를 엽니다. 다른 브라우저에서도 완료할 수 있지만, 로컬 주소 `127.0.0.1`은 링크를 여는 기기 자신을 가리킵니다. 로컬 테스트에서는 앱이 실행 중인 컴퓨터에서 메일 링크를 여세요.
3. `/account`로 이동하고 새로고침해도 로그인 상태가 유지되는지 확인합니다. 링크가 만료됐거나 다른 브라우저에서 열렸다면 `/login?error=link`로 돌아옵니다.
4. 실제 이용약관·개인정보 처리 안내 URL과 `LEGAL_VERSION`이 확정되기 전에는 모집공고자 정보 저장이 비활성화됩니다. 현장·공고 등록 흐름은 이 설정과 실제 현장 등록 후 검증합니다.

로컬 Supabase CLI의 `config.toml`과 원격 대시보드 설정은 별개입니다. GitHub 연결만으로 원격 Redirect URLs가 변경되지는 않습니다.
