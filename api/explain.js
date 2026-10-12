// 최적 선택지 비교 결과를 LLM이 한두 문장으로 정리해 줘요.
// ANTHROPIC_API_KEY 환경변수가 없으면 501을 돌려주고, 앱은 정리 칸을 숨겨요.
const MODEL = process.env.EXPLAIN_MODEL || 'claude-sonnet-5-5'
const DAILY_LIMIT = Number(process.env.EXPLAIN_DAILY_LIMIT || 300)
let day = ''
let count = 0

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(501).json({ error: 'disabled' })
  if (req.method !== 'POST') return res.status(405).end()
  const today = new Date().toISOString().slice(0, 10)
  if (today !== day) { day = today; count = 0 }
  if (++count > DAILY_LIMIT) return res.status(429).json({ error: 'limit' })

  const { policy, answers, ranking } = req.body || {}
  if (!policy || !Array.isArray(ranking) || ranking.length > 20) return res.status(400).json({ error: 'bad request' })

  const prompt = `청년 정책 "${String(policy).slice(0, 60)}" 가입 기관 비교 결과를 사용자에게 설명해 주세요.
사용자 답변: ${JSON.stringify(answers).slice(0, 300)}
계산된 순위(연 금리, 채운 우대 조건 met, 못 채운 조건 miss): ${JSON.stringify(ranking).slice(0, 2000)}
규칙: 한국어 "~해요" 말투, 2문장 이내. 1위와 그 이유(어떤 우대 조건 덕분인지)를 말하고, 순위를 바꿀 수 있는 조건이 있으면 한 가지만 짚어요. 계산된 숫자만 쓰고 새 숫자를 만들지 마세요. "추천" 대신 "내 조건 기준으로"라고 표현해요.`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) return res.status(502).json({ error: `llm ${r.status}` })
    const j = await r.json()
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim()
    res.status(200).json({ text })
  } catch (e) {
    res.status(502).json({ error: String(e) })
  }
}
