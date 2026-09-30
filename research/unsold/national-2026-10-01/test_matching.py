import unittest
from match_existing import classify, parcels

class MatchingTests(unittest.TestCase):
    def project(self,id,address,name='같은 이름'):
        return {'id':id,'address':address,'name':name}
    def test_wrong_district_is_not_same_site(self):
        s={'region':'부산','name':None,'address':'부산광역시 동구 수정동 123-4'}
        p=self.project('a','부산광역시 서구 수정동 123-4')
        self.assertEqual(classify(s,[p])[0],'held')
    def test_ambiguous_parcel_is_held(self):
        s={'region':'충북','name':None,'address':'충청북도 청주시 용암동 산222'}
        ps=[self.project(str(i),'충청북도 청주시 용암동 산222번지') for i in range(2)]
        self.assertEqual(classify(s,ps)[0],'held')
    def test_mountain_parcel_is_not_regular_parcel(self):
        self.assertFalse(parcels('용암동 산222') & parcels('용암동 222'))
    def test_different_parcel_blocks_name_match(self):
        s={'region':'충북','name':'같은 이름','address':'충청북도 청주시 용암동 123'}
        self.assertEqual(classify(s,[self.project('a','충청북도 청주시 용암동 456')])[0],'held')
    def test_unique_same_parcel_is_matched(self):
        s={'region':'충북','name':None,'address':'충청북도 청주시 상당구 용암동 산222'}
        self.assertEqual(classify(s,[self.project('a','충청북도 청주시 상당구 용암동 산222번지 일원')])[0],'matched')

if __name__=='__main__': unittest.main()
