/**
 * 게임 상태 타입 정의
 */
export interface GameState {
  title: string;
  characters?: Character[];
  world?: WorldState;
  inventory?: InventoryItem[];
  story?: StoryState;
  [key: string]: any; // 유연한 구조를 위해 추가 프로퍼티 허용
}

export interface Character {
  name: string;
  level?: number;
  hp?: number;
  mp?: number;
  class?: string;
  favorability?: number;
  [key: string]: any;
}

export interface WorldState {
  location?: string;
  time?: string;
  weather?: string;
  [key: string]: any;
}

export interface InventoryItem {
  name: string;
  quantity?: number;
  type?: string;
  [key: string]: any;
}

export interface StoryState {
  chapter?: number;
  progress?: string;
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
  value: any;
}

export interface GetGameParams {
  gameId: string;
}

/**
 * 응답 타입들
 */
export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface ErrorResponse {
  error: string;
  tool: string;
  timestamp: string;
}
