import requests,pathlib
from concurrent.futures import ThreadPoolExecutor
base=pathlib.Path(__file__).parent
urls={'seoul-common':'https://land.seoul.go.kr/land/resources/js/g3way.land.common.js','busan-latest':'https://www.busan.go.kr/depart/absalesinfo/1756577','incheon-latest':'https://www.incheon.go.kr/build/BU050301/3085562','daegu-list':'https://www.daegu.go.kr/build/index.do?bbsId=BBS_00153&menu_id=00001338&menu_link=/icms/bbs/selectBoardList.do','daejeon-list':'https://www.daejeon.go.kr/urb/UrbNormalboardList.do?boardId=normal_0033&menuSeq=1246','ulsan-latest':'https://www.ulsan.go.kr/u/metro/bbs/view.do?mId=001008005003000000&bbsId=BBS_0000000000000102&dataId=184232','gwangju-latest':'https://www.gwangju.go.kr/build/boardView.do?boardId=BD_0000000288&pageId=build23&seq=528','sejong':'https://www.sejong.go.kr/' }
def go(z):
 k,u=z
 try:
  r=requests.get(u,timeout=30);(base/(k+'.html')).write_text(r.text); print(k,r.status_code,len(r.content))
 except Exception as e:print(k,str(e)[:100])
with ThreadPoolExecutor(max_workers=8) as ex:list(ex.map(go,urls.items()))
