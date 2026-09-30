import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('pipeline', Path(__file__).with_name('naver_pipeline.py'))
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)

class Matching(unittest.TestCase):
    def test_same_name_parcel(self):
        row = dict(name='김포 아파트', address='경기도 김포시 북변동 224-67번지 일원')
        self.assertTrue(p.same_notice(row, dict(name='김포아파트', address='경기도 김포시 북변동 224-67')))
        self.assertFalse(p.same_notice(row, dict(name='김포 아파트 2차', address=row['address'])))
        self.assertFalse(p.same_notice(row, dict(name=row['name'], address='경기도 김포시 북변동 224-68')))
    def test_distinct_block(self):
        self.assertFalse(p.same_notice(dict(name='호반써밋', address='경기도 김포시 풍무동 1-1 B5블록'), dict(name='호반써밋', address='경기도 김포시 풍무동 1-1 B4블록')))
    def test_list_detail_identity(self):
        item = dict(name='김포 아파트', build_dtl_cd='1', supp_cd='2', region=['김포시', '북변동'], ypos='37.62', xpos='126.70')
        info = dict(build_nm='김포아파트', build_dtl_cd='1', supp_cd='2')
        self.assertTrue(p.verified_listing(item, info, '경기도 김포시 북변동 1-1'))
        self.assertFalse(p.verified_listing(item, info, '경기도 김포시 풍무동 1-1'))
        info['supp_cd'] = '3'
        self.assertFalse(p.verified_listing(item, info, '경기도 김포시 북변동 1-1'))
    def test_rental_and_elapsed(self):
        info = dict(bclass_nm='아파트', supp_sclass='민간분양', move_in_date='입주 2026.09', supp_proc_step_nm='입주예정')
        self.assertIsNone(p.classify(info, '경기도 김포시 북변동 1-1', '2026-10-01')[0])
        info['move_in_date'] = '입주 2029.12'
        self.assertEqual(p.classify(info, '경기도 김포시 북변동 1-1', '2026-10-01')[0], '2029.12')
        info['supp_sclass'] = '민간임대'
        self.assertIsNone(p.classify(info, '경기도 김포시 북변동 1-1', '2026-10-01')[0])

if __name__ == '__main__': unittest.main()
