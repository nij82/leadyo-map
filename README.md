# Leadyo Map

아파트 분양 현장과 모집공고를 탐색하는 실제 서비스의 개발 저장소입니다.

## 브랜치

- `main`: Next.js/TypeScript 서비스 개발 코드
- `demo-v0.26`: 이전 단일 HTML 데모 보관

서비스 코드는 [`service/`](service/)에 있습니다. 가입·데이터베이스 연동은 Supabase 연결 후 검증해야 하며, 현재 출시 준비 단계입니다.

## 로컬 실행

Node.js 22 이상:

```sh
cd service
npm ci
cp .env.example .env.local
npm run dev
```

환경변수는 로컬 또는 호스팅 서비스에 별도로 설정합니다. 비밀키를 Git에 올리지 않습니다.

## 새 웹 프로젝트의 GitHub 연결

| 설정 | 값 |
|---|---|
| 저장소 | `nij82/leadyo-map` |
| 브랜치 | `main` |
| Root / Base directory | `service` |
| 프레임워크 | Next.js |
| 빌드 명령 | `npm run build` |

Supabase 프로젝트 생성과 마이그레이션 적용은 웹 호스팅 연결과 별도입니다.

설정 방법과 구현 범위는 [서비스 안내](service/README.md)를 참고하세요.
