import { randomUUID } from 'crypto';
import { Game, GameState, GameResponse } from './types.js';

/**
 * 게임 관리자 클래스
 * 게임 생성, 업데이트, 조회를 담당
 */
export class GameManager {
  private games: Map<string, Game> = new Map();

  /**
   * 새 게임 생성
   */
  createGame(initialState: GameState): GameResponse {
    const gameId = randomUUID();
    const now = new Date();
    
    const game: Game = {
      gameId,
      state: initialState,
      createdAt: now,
      updatedAt: now
    };
    
    this.games.set(gameId, game);
    
    console.error(`Game created with ID: ${gameId}`);
    return {
      game,
      nextActions: ["progressStory"]
    };
  }

  /**
   * 게임 상태 업데이트
   */
  updateGame(gameId: string, fieldSelector: string, value: any): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    // 게임 상태의 깊은 복사본 생성
    const newState = JSON.parse(JSON.stringify(game.state));
    
    // 경로에서 'game.' 접두사 제거 (호환성)
    const cleanPath = fieldSelector.replace(/^game\./, '');
    
    // 중첩된 값 설정
    this.setNestedValue(newState, cleanPath, value);
    
    // 게임 업데이트
    game.state = newState;
    game.updatedAt = new Date();
    
    console.error(`Game ${gameId} updated: ${fieldSelector} = ${JSON.stringify(value)}`);
    return {
      game,
      nextActions: ["progressStory"]
    };
  }

  /**
   * 게임 조회
   */
  getGame(gameId: string): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    return {
      game,
      nextActions: []
    };
  }


  /**
   * 스토리 진행
   */
  progressStory(gameId: string, progress: string): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    // progress 파라미터를 활용해 스토리 진행 상황을 기록하거나 반영할 수 있음
    game.state.story = game.state.story || {};
    game.state.story.progress = progress;
    game.updatedAt = new Date();
    console.error(`Game ${gameId} story progressed: ${progress}`);
    return {
      game,
      nextActions: ["promptUserActions"]
    };
  }

  /**
   * 사용자 액션 프롬프트
   */
  promptUserActions(gameId: string, options: string[]): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }
    // options 파라미터를 활용해 유저에게 선택지를 제시
    // 게임 상태와 분리된 메타데이터로 저장하는 것이 더 안전할 수 있음
    game.state._currentOptions = options; // 앞에 _를 붙여 시스템 필드임을 표시
    game.updatedAt = new Date();
    console.error(`Game ${gameId} prompting user actions: ${JSON.stringify(options)}`);
    return {
      game,
      nextActions: []
    };
  }

  /**
   * 중첩된 객체의 값을 설정하는 헬퍼 메서드
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = this.parsePath(path);
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!(key in current)) {
        // 다음 키가 숫자인지 확인하여 배열 또는 객체 생성
        const nextKey = keys[i + 1];
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 경로를 파싱하여 키 배열로 변환
   * 예: "characters[0].name" -> ["characters", "0", "name"]
   */
  private parsePath(path: string): string[] {
    const result: string[] = [];
    let current = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        if (current) {
          result.push(current);
          current = '';
        }
        inBrackets = true;
      } else if (char === ']') {
        if (current) {
          result.push(current);
          current = '';
        }
        inBrackets = false;
      } else if (char === '.' && !inBrackets) {
        if (current) {
          result.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }

  /**
   * 모든 게임 목록 조회 (디버깅용)
   */
  getAllGames(): Game[] {
    return Array.from(this.games.values());
  }

  /**
   * 게임 삭제 (정리용)
   */
  deleteGame(gameId: string): boolean {
    return this.games.delete(gameId);
  }
}
