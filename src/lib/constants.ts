import type { AxisKey } from './types'

export const AXES: { key: AxisKey; name: string; img: string; desc: string; color: string; bg: string }[] = [
  { key: 'h', name: '주거', img: '/assets/house.png', desc: '임대주택 공고, 공공분양 청약, 전월세 대출·보증', color: '#2563EB', bg: '#EAF1FE' },
  { key: 'f', name: '금융·자산', img: '/assets/money.png', desc: '정부 매칭 적금, 월세 지원금, 전세보증료 지원', color: '#C2410C', bg: '#FDEEE3' },
  { key: 'j', name: '취업·수당', img: '/assets/briefcase.png', desc: '구직 수당, 직업훈련, 취업·근속 장려금', color: '#0F766E', bg: '#E2F4F1' },
  { key: 't', name: '세금', img: '/assets/receipt.png', desc: '지금 받을 수 있는 세금 혜택과 바뀌는 점', color: '#7C3AED', bg: '#F1EAFD' },
]
export const axisOf = (k: AxisKey) => AXES.find((a) => a.key === k)!

export const SIDO: Record<string, string[]> = {
  서울: ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
}

export const VULNERABLE = [
  '해당 없음',
  '기초생활수급자',
  '차상위계층',
  '한부모가족',
  '자립준비청년 (보호종료)',
  '장애인',
  '국가유공자·보훈대상자',
  '북한이탈주민',
  '다문화가족',
  '고시원 등 비주택 거주',
]

export const DISCLAIMER = '입력한 정보로 계산한 참고용 결과예요. 실제 자격은 신청 기관 심사로 확정돼요.'
