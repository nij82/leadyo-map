# 화면 및 컴포넌트

목적: 비회원의 현장 탐색과 직접 연락, 모집자의 간단한 공고 등록.

```
RootLayout
  Header (현재 인증 상태에 따른 메뉴)
  Explorer
    Search / RegionFilter / ProductFilter / RoleFilter / SupportFilter
    ProjectList (desktop)
    NaverMap
    ProjectDetail (mobile fullscreen)
      Summary (scrolls)
      TypedListingCard / ProductDetails
      Phone / KakaoContact
  LoginForm (email login link)
  Account / RecruiterProfile
  Manage
    ListingForm
    ListingStatusForm
    SiteRequestForm
  Admin
    Moderation / MemberStatus / ProjectForm / AuditLog
```

기존 파란색과 중립 배경 유지. 본문 15px, 폼 모바일 16px, 헤더 24~25px. 모바일에서 지도 위 현장 목록을 덮지 않고 상세만 화면 전체 표시. 지도 키/DB 미연결은 명시적 준비 상태이며 샘플 데이터로 대체하지 않음.

보안 판단은 서버 액션에서 검증하고 DB RLS/트리거로 반복 강제. 민감한 역할·정지 정보는 private 스키마에 둠. `private.owner_active`는 공개 공고 조회를 위해 상태를 boolean으로만 노출하는 의도적 helper이며 테이블 행은 노출하지 않음. 운영 조치 RPC는 auth.uid와 현재 관리자 상태 확인 후 트랜잭션 안에서 조치+기록을 수행.

데이터 스키마 단일 원본은 supabase/migrations/*.sql. 테스트용 데이터는 tests 안에서만 생성하며 운영 seed가 없음. 로컬 코드·마이그레이션 검증과 운영 DB 적용·배포는 별도 단계다.

공고의 `product_type`, `rate_options`, `supports`는 필터와 상세 카드가 공유하는 구조화된 데이터다. 기존 `rates`와 `support`는 이전 공고 호환용으로 유지한다. 새 공고의 `rates`에는 첫 타입의 금액을 저장하되 화면에서는 `rate_options`만 기준으로 표시한다. 기존 공고의 새 필드를 추정해 채우지 않는다.
