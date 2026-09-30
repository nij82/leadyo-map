import unittest
from collect_gyeonggi_unsold import extract, matches, classify

class Sheet:
    def __init__(self, rows): self.rows=rows
    def iter_rows(self, **kwargs): return iter(self.rows)

def row(**values):
    out=[None]*18
    for key, value in values.items(): out[int(key)]=value
    return tuple(out)

class UnsoldTests(unittest.TestCase):
    project={'id':'one','name':'단지','address':'경기도 용인시 고림동 산105-8번지','product_types':['apartment']}
    group={'row':7,'city':'용인시','address':'고림동 산105-8 일원','sale_type':'분양','positive_rows':[7]}

    def test_subtotal_stops_anonymous_site_inheriting_address(self):
        rows=[row(**{'1':'용인시','3':'고림동 1','10':'분양','11':'84','14':0}),
              row(**{'6':'소 계','14':0}),row(**{'11':'84','14':10})]
        self.assertEqual(extract(Sheet(rows))[0]['positive_rows'],[])

    def test_merged_sale_type_and_company_name(self):
        rows=[row(**{'1':'용인시','3':'고림동 1','10':'분양','6':'계룡건설','11':'84','14':3}),
              row(**{'6':'소계'}),row(**{'3':'고림동 2','11':'84','14':1})]
        groups=extract(Sheet(rows))
        self.assertTrue(groups[0]['positive_rows'])
        self.assertEqual(groups[1]['sale_type'],'분양')

    def test_city_parcel_and_hillside_are_required(self):
        self.assertTrue(matches(self.group,self.project))
        self.assertFalse(matches(self.group,{**self.project,'address':'경기도 용인시 고림동 105-8'}))
        self.assertFalse(matches(self.group,{**self.project,'address':'경기도 수원시 고림동 산105-8'}))
        self.assertFalse(matches(self.group,{**self.project,'address':'경기도 용인시 역북동 산105-8'}))

    def test_building_level_or_other_product_cannot_match(self):
        self.assertFalse(matches(self.group,{**self.project,'name':'단지 102동'}))
        self.assertFalse(matches(self.group,{**self.project,'product_types':['officetel']}))

    def test_ambiguous_or_private_is_held(self):
        verified,held=classify([self.group],[self.project,{**self.project,'id':'two'}],'hash')
        self.assertFalse(verified);self.assertEqual(len(held),1)
        verified,held=classify([{**self.group,'address':'비공개'}],[self.project],'hash')
        self.assertFalse(verified);self.assertEqual(held[0]['reason'],'private_source_address')

    def test_confirmed_has_provenance_and_no_inventory_count(self):
        verified,_=classify([self.group],[self.project],'hash')
        evidence=verified[0]['unsold_evidence']
        self.assertEqual(evidence['status'],'confirmed')
        self.assertEqual(evidence['as_of'],'2026-08-31')
        self.assertNotIn('units',evidence)

    def test_zero_and_missing_are_never_marked_sold_out(self):
        verified,held=classify([{**self.group,'positive_rows':[]}],[self.project],'hash')
        self.assertFalse(verified);self.assertFalse(held)

if __name__=='__main__':unittest.main()
