// 목표(튜토리얼 겸 진행 안내). 최종 목표는 로켓을 만들어 화성으로 가는 것!
const got = (g, id) => g.stats.got[id] || 0;
const crafted = (g, id) => g.stats.crafted[id] || 0;
const placed = (g, id) => g.stats.placed[id] || 0;

export const QUESTS = [
  { title: '나무 베기', desc: '나무에 마우스를 대고 길게 눌러 원목 4개를 모으세요.', done: (g) => got(g, 'log') >= 4, prog: (g) => [got(g, 'log'), 4] },
  { title: '판자 만들기', desc: 'E 키로 가방을 열고, 제작 목록에서 판자를 만드세요.', done: (g) => crafted(g, 'plank') >= 1 },
  { title: '제작대 설치', desc: '제작대를 만들어 단축바에서 고른 뒤, 땅을 클릭해 설치하세요.', done: (g) => placed(g, 'workbench') >= 1 },
  { title: '첫 도구', desc: '제작대를 우클릭해서 나무 곡괭이를 만드세요. (막대기도 필요해요)', done: (g) => crafted(g, 'wood_pickaxe') >= 1 },
  { title: '돌 모으기', desc: '돌멩이를 줍거나 곡괭이로 바위를 캐서 돌 8개를 모으세요.', done: (g) => got(g, 'stone') >= 8, prog: (g) => [got(g, 'stone'), 8] },
  { title: '돌 곡괭이', desc: '제작대에서 돌 곡괭이를 만드세요. 철광석을 캘 수 있게 됩니다.', done: (g) => crafted(g, 'stone_pickaxe') >= 1 },
  { title: '동굴 탐험', desc: '미니맵의 노란 화살표를 따라 동굴 입구를 찾아 우클릭으로 들어가세요.', done: (g) => !!g.stats.flags.cave },
  { title: '석탄과 횃불', desc: '지하에서 석탄(검은 점이 박힌 돌)을 캐서 횃불을 만드세요.', done: (g) => crafted(g, 'torch') >= 1 },
  { title: '화로 설치', desc: '제작대에서 돌 8개로 화로를 만들어 설치하세요.', done: (g) => placed(g, 'furnace') >= 1 },
  { title: '철 제련', desc: '화로에 철광석과 연료(석탄·나무)를 넣어 철 주괴를 만드세요.', done: (g) => (g.stats.smelted.iron_ingot || 0) >= 1 },
  { title: '철 곡괭이', desc: '철 주괴 3개와 막대기 2개로 철 곡괭이를 만드세요.', done: (g) => crafted(g, 'iron_pickaxe') >= 1 },
  { title: '농사 짓기', desc: '괭이로 풀밭을 갈고 밀 씨앗(수풀에서 나와요)을 심어, 밀 3개를 수확하세요.', done: (g) => got(g, 'wheat') >= 3, prog: (g) => [got(g, 'wheat'), 3] },
  { title: '든든한 한 끼', desc: '제작대에서 밀 3개로 빵을 구우세요.', done: (g) => crafted(g, 'bread') >= 1 },
  { title: '공장의 시작', desc: '철 주괴 2개로 톱니바퀴를 만드세요. 모든 기계의 첫 부품입니다.', done: (g) => crafted(g, 'gear') >= 1 },
  { title: '다음 시대를 기다리며', desc: '지금은 여기까지! 다음 업데이트에서 컨베이어 벨트와 채굴기로 공장을 짓게 됩니다.', done: () => false, last: true },
];

export function checkQuests(game) {
  let advanced = false;
  while (game.quest < QUESTS.length - 1 && QUESTS[game.quest].done(game)) {
    const q = QUESTS[game.quest];
    game.quest++;
    advanced = true;
    game.ui.toast(`목표 달성: ${q.title}`, 'good');
    game.audio.play('quest');
  }
  return advanced;
}
