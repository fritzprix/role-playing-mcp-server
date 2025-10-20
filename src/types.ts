/**
 * 상황과 선택된 액션의 히스토리 항목
 */
export interface GameHistoryEntry {
  situation: string; // 주어진 상황/스토리 진행
  options: string[]; // 주어진 선택지들
  selectedOption: string; // 선택된 옵션
  selectedIndex: number; // 선택된 인덱스
  timestamp: Date; // 선택 시점
}

/**
 * Delta 정보 타입
 */
export interface DeltaInfo {
  field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  finalValue: any;
  timestamp: Date;
  description: string;
}

/**
 * 게임 상태 타입 정의
 */
export interface GameState {
  title: string;
  characters?: Character[];
  world?: WorldState;
  inventory?: InventoryItem[];
  story?: StoryState;
  lastStoryProgress?: string;
  gameHistory?: GameHistoryEntry[]; // 최근 상황-액션 히스토리 (최대 10개)
  selectedAction?: {
    option: string;
    index: number;
    timestamp: Date;
  };
  _pendingDeltas?: DeltaInfo[]; // promptUserAction 사이의 누적 변경사항
  _lastPromptTime?: Date; // 마지막 promptUserAction 호출 시간
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // 유연한 구조를 위해 추가 프로퍼티 허용
}

export interface Character {
  name: string;
  level?: number;
  hp?: number;
  mp?: number;
  class?: string;
  favorability?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface WorldState {
  location?: string;
  time?: string;
  weather?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface InventoryItem {
  name: string;
  quantity?: number;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface StoryState {
  chapter?: number;
  progress?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * 게임 객체 타입
 */
export interface Game {
  gameId: string;
  state: GameState;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 도구 매개변수 타입들
 */
export interface CreateGameParams {
  initialStateInJson: GameState;
}

export interface UpdateGameParams {
  gameId: string;
  fieldSelector: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export interface GetGameParams {
  gameId: string;
}

export interface ProgressStoryParams {
  gameId: string;
  progress: string;
}

export interface PromptUserActionsParams {
  gameId: string;
  options: string[];
}

export interface SelectActionParams {
  gameId: string;
  selectedOption: string;
  selectedIndex: number;
}

/**
 * 게임 응답 타입 - nextActions를 포함
 */
export interface GameResponse {
  game: Game;
  nextActions: string[];
}

/**
 * 응답 타입들
 */
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface ErrorResponse {
  error: string;
  tool: string;
  timestamp: string;
}
