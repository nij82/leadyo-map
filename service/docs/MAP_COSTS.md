# 네이버 / 카카오 지도 비교

2026-09-24 공식 문서 확인 기준. 계정별 실제 무료량 적용은 콘솔에서 확인해야 합니다.

| 항목 | 네이버 Maps | 카카오 지도 Web SDK |
|---|---|---|
| 지도 무료량 | 대표 계정 1개 기준 월 6,000,000건 | 개발자 계정 최초 활성 앱 일 300,000건; 월간 공통 쿼터도 확인 |
| 지도 유료 단가 | 0.1원/건 (VAT 별도) | 0.1원/건 (공식 쿼터 요금표) |
| 주소→좌표 | 월 3,000,000건 무료, 초과 0.5원/건 | 첫 활성 앱 일 100,000건 무료, 유료 0.5원/건 |

최소 기능 초기 트래픽과 무료 적용 계정이라는 전제에서는 비용 때문에 카카오로 바꿀 이유가 없습니다. 사용자 선택대로 네이버로 준비합니다. API 사용 횟수는 방문자 수와 같지 않으며 SDK 생성/조회 방식에 따라 달라집니다.

네이버는 신규 Maps 상품을 사용합니다. 구 AI NAVER API 지도 상품은 무료 이용량 정책이 다릅니다. 카카오는 2026-07-21부터 무료량을 계정의 최초 활성 앱에만 제공하므로 기존에 다른 앱에서 사용했다면 무료를 전제할 수 없습니다.

- https://m.ncloud.com/charge/price/ko
- https://www.ncloud.com/api-cms/service-product/static/maps
- https://guide.ncloud-docs.com/docs/application-maps-app-vpc
- https://developers.kakao.com/docs/ko/getting-started/quota
- https://developers.kakao.com/docs/ko/kakaomap/common

운영시 무료량 적용, 일/월 사용 한도, 알림, 초과 사용 허용 여부를 확인합니다. 클라이언트 키는 도메인 제한을 적용합니다.
