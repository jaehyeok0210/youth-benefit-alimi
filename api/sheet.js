// Vercel 서버리스 함수: 구글 시트 탭을 CSV로 가져와 그대로 돌려줘요.
// 시트는 "링크가 있는 모든 사용자 보기"로 공유돼 있어야 해요.
const SHEET_ID = '1BlsJOfkcSD0y_8IwpTVq10YqkH8U6Ugyx1MlEslxgoU'
const GID = { policies: 1, eligibility: 2, relations: 3, standards: 4 }

export default async function handler(req, res) {
  const tab = String(req.query.tab || '')
  if (!(tab in GID)) {
    res.status(400).send('unknown tab')
    return
  }
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID[tab]}`, {
      redirect: 'follow',
    })
    if (!r.ok) throw new Error(`sheet ${r.status}`)
    const text = await r.text()
    if (text.trim().startsWith('<')) throw new Error('not csv')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600')
    res.status(200).send(text)
  } catch (e) {
    res.status(502).send(String(e))
  }
}
