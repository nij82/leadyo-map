import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('review',Path(__file__).with_name('review_naver_holds.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Identity(unittest.TestCase):
    def test_renamed_project_same_parcel(self):
        a=dict(name='한양아이클래스양주',address='경기도 양주시 은현면 용암리 784-8번지 일원',latitude=37.8467342,longitude=127.0399674)
        b=dict(name='양주 용암 영무 예다음 더퍼스트',address=a['address'],latitude=37.8472899,longitude=127.0395896)
        self.assertTrue(m.identity(a,b))
    def test_neighboring_distinct_parcels(self):
        a=dict(name='새 현장',address='경기도 양주시 은현면 용암리 784-8번지',latitude=37.8467,longitude=127.0399)
        b=dict(name='다른 현장',address='경기도 양주시 은현면 용암리 784-9번지',latitude=37.8468,longitude=127.0399)
        self.assertFalse(m.identity(a,b))
    def test_blocks_and_phases_not_merged(self):
        a=dict(name='현장 1단지',address='경기도 김포시 사우동 1-1번지 B4블록',latitude=37.6,longitude=126.7)
        b=dict(name='현장 2단지',address='경기도 김포시 사우동 1-1번지 B5블록',latitude=37.6,longitude=126.7)
        self.assertFalse(m.identity(a,b))
    def test_same_number_different_village_not_merged(self):
        a=dict(name='현장',address='경기도 양주시 은현면 용암리 1-1번지',latitude=37.8,longitude=127.0)
        b=dict(name='현장',address='경기도 양주시 은현면 봉암리 1-1번지',latitude=37.8,longitude=127.0)
        self.assertFalse(m.identity(a,b))

if __name__=='__main__':unittest.main()
