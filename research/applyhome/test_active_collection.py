"""Regression checks for collection date boundaries and incomplete API responses."""
import unittest
from datetime import date
from unittest.mock import Mock, patch

import fetch_current
from fetch_active_projects import classify, parse_day, parse_month, prepare


class ActiveCollectionTests(unittest.TestCase):
    as_of = date(2026, 9, 30)

    def review(self, **fields):
        return classify({"RCRIT_PBLANC_DE": "2023-12-01", **fields}, self.as_of)

    def test_old_notice_with_future_move_in(self):
        result = self.review(MVN_PREARNGE_YM="202710")
        self.assertEqual(result["eligibility_status"], "candidate_for_location_review")
        self.assertEqual(result["current_sale_status"], "unverified")

    def test_current_month_is_not_dropped(self):
        self.assertEqual(self.review(MVN_PREARNGE_YM="202609")["inclusion_reasons"], ["planned_move_in"])

    def test_sale_schedule_after_past_move_in(self):
        result = self.review(MVN_PREARNGE_YM="202501", CNTRCT_CNCLS_ENDDE="20261001")
        self.assertEqual(result["inclusion_reasons"], ["remaining_application_or_contract_schedule"])

    def test_schedule_boundary_today_and_yesterday(self):
        self.assertTrue(self.review(SUBSCRPT_RCEPT_ENDDE="2026-09-30")["inclusion_reasons"])
        self.assertFalse(self.review(SUBSCRPT_RCEPT_ENDDE="2026-09-29")["inclusion_reasons"])

    def test_past_and_missing_dates_need_sale_verification(self):
        for fields in ({}, {"MVN_PREARNGE_YM": "202501"}, {"MVN_PREARNGE_YM": "미정"}):
            self.assertEqual(self.review(**fields)["eligibility_status"], "needs_current_sale_verification")

    def test_future_or_invalid_publication_needs_review(self):
        for published in ("20261001", "invalid", ""):
            self.assertEqual(self.review(RCRIT_PBLANC_DE=published, MVN_PREARNGE_YM="202801")["eligibility_status"], "needs_publication_date_verification")

    def test_date_formats_and_invalid_dates(self):
        self.assertEqual(parse_day("2026-09-30"), parse_day("20260930"))
        self.assertEqual(parse_month("2026.09"), parse_month("202609"))
        self.assertIsNone(parse_day("20260230"))
        self.assertIsNone(parse_month("202613"))

    def test_winner_announcement_does_not_establish_sale(self):
        self.assertFalse(self.review(PRZWNER_PRESNATN_DE="20261001")["inclusion_reasons"])

    def test_normalization_keeps_existing_type_exclusions(self):
        row = {"HOUSE_MANAGE_NO": "1", "PBLANC_NO": "2", "HOUSE_NM": "현장", "HSSPLY_ADRES": "주소", "RCRIT_PBLANC_DE": "20231201", "MVN_PREARNGE_YM": "202710"}
        eligible, held = prepare({"apartment": [row, {**row, "RENT_SECD": "1"}], "officetel": [{**row, "HOUSE_DTL_SECD_NM": "민간임대"}]}, self.as_of, set())
        self.assertEqual(len(eligible), 1)
        self.assertFalse(held)
        self.assertTrue(eligible[0]["new_to_previous_collection"])
        eligible, _ = prepare({"apartment": [row]}, self.as_of, {("apartment", "1", "2")})
        self.assertFalse(eligible[0]["new_to_previous_collection"])

    @patch.object(fetch_current.requests, "get")
    def test_full_history_and_legacy_queries(self, get):
        response = Mock()
        response.json.return_value = {"data": [{"id": 1}], "matchCount": 1}
        get.return_value = response
        fetch_current.fetch("test", "dummy", start_date=None)
        self.assertNotIn("cond[", get.call_args.args[0])
        fetch_current.fetch("test", "dummy")
        self.assertIn("2025-01-01", get.call_args.args[0])

    @patch.object(fetch_current.requests, "get")
    def test_incomplete_api_response_is_rejected(self, get):
        response = Mock()
        response.json.return_value = {"data": [{"id": 1}], "matchCount": 2}
        get.return_value = response
        with self.assertRaises(SystemExit):
            fetch_current.fetch("test", "dummy", start_date=None)


if __name__ == "__main__":
    unittest.main()
