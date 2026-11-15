// 전역 상수
// 버전 규칙:  0.0.1 ↑ 버그 수정·문구·작은 조정  |  0.1 ↑ 새 기능·콘텐츠  |  1.0 = 공장→로켓→화성까지 끝까지 플레이 가능해질 때
// 올릴 때는 package.json 과 README 의 버전·기록도 함께 맞춘다.
export const VERSION = '0.20.0';
export const TILE = 16;            // 타일 한 칸의 도트 크기
export const MAP_W = 512;
export const MAP_H = 512;
export const SURFACE = 0;          // 지상 레이어
export const CAVE = 1;             // 지하 레이어
export const DAY_LENGTH = 720;     // 하루 길이(초) — 게임 속 1시간 = 30초
export const REACH = 3.7;          // 손이 닿는 거리(타일)
export const INV_SIZE = 36;        // 0~8 단축바, 9~35 가방
export const HOTBAR = 9;
export const SAVE_VERSION = 1;
export const WALL_LIFT = 6;        // 벽 블록이 위로 솟아 보이는 높이(px)
// 플레이어 안전모 색 (멀티플레이에서 방장이 0번, 손님은 들어온 순서대로)
export const PLAYER_COLORS = [0xf4c430, 0xe2504a, 0x4a8fe0, 0x58b548, 0x9a5fd6, 0xf08a2e, 0x3fc7c7, 0xf07ab0];
export const ROOF_LIFT = 12;       // 지붕이 떠 보이는 높이(px) — 남쪽 벽과 문이 지붕 아래로 보이도록 벽보다 높다
