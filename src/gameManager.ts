import { randomUUID } from 'crypto';
import type { Game, GameResponse, GameState, DeltaInfo } from './types.js';

/**
 * 게임 관리자 클래스
 * 게임 생성, 업데이트, 조회를 담당
 */
export class GameManager {
  private games: Map<string, Game> = new Map();
  private maxGames: number;
  private static readonly FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  constructor(maxGames: number = 100) {
    if (typeof maxGames !== 'number' || maxGames <= 0 || !Number.isInteger(maxGames)) {
      throw new Error('maxGames must be a positive integer');
    }
    this.maxGames = maxGames;
  }

  /**
   * LRU 캐시 갱신: 가장 최근에 사용된 게임을 Map의 끝으로 이동
   */
  private touchGame(gameId: string, game: Game): void {
    this.games.delete(gameId);
    this.games.set(gameId, game);
  }

  /**
   * Plain object 판별 type guard
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  private isGameState(value: unknown): value is GameState {
    return this.isPlainObject(value);
  }

  /**
   * 새 게임 생성
   */
  createGame(initialStateInput: GameState | string): GameResponse {
    let parsedState: unknown;
    if (typeof initialStateInput === 'string') {
      try {
        parsedState = JSON.parse(initialStateInput);
      } catch (e) {
        console.error('Failed to parse initialState:', e);
        throw new Error('Invalid JSON string for initialState');
      }
    } else {
      parsedState = initialStateInput;
    }

    if (!this.isGameState(parsedState)) {
      throw new Error('initialState must be a non-null plain object');
    }

    // deep clone to isolate from caller mutations
    const initialState: GameState = structuredClone(parsedState);
    const gameId = randomUUID();
    const now = new Date();

    const game: Game = {
      gameId,
      state: initialState,
      createdAt: now,
      updatedAt: now,
    };

    // 최대 게임 수 초과 시 가장 오래 참조되지 않은 게임 삭제 (LRU)
    if (this.games.size >= this.maxGames) {
      const oldestKey = this.games.keys().next().value;
      if (oldestKey) {
        this.games.delete(oldestKey);
      }
    }

    this.games.set(gameId, game);

    console.error(`Game created with ID: ${gameId}`);
    return {
      game,
      nextActions: ['progressStory'],
    };
  }

  /**
   * 게임 상태 업데이트
   */
  updateGame(gameId: string, fieldSelector: string, value: unknown): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    if (!fieldSelector || typeof fieldSelector !== 'string' || fieldSelector.trim() === '') {
      throw new Error('fieldSelector parameter cannot be empty');
    }

    // 경로에서 'game.' 접두사 제거 (호환성)
    const cleanPath = fieldSelector.replace(/^game\./, '').trim();
    if (!cleanPath) {
      throw new Error('fieldSelector parameter cannot be empty');
    }

    // 게임 상태의 깊은 복사본 생성 (Date 등 보존)
    const newState: GameState = structuredClone(game.state);

    // Delta 정보 추가/업데이트
    this.addOrUpdateDelta(newState, cleanPath, value);

    // 중첩된 값 설정
    this.setNestedValue(newState, cleanPath, value);

    // 게임 업데이트
    game.state = newState;
    game.updatedAt = new Date();
    this.touchGame(gameId, game);

    console.error(`Game ${gameId} updated: ${fieldSelector} = ${JSON.stringify(value)}`);
    return {
      game,
      nextActions: ['progressStory'],
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
    this.touchGame(gameId, game);
    return {
      game,
      nextActions: [],
    };
  }

  selectAction(gameId: string, selectedOption: string, selectedIndex: number): GameResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game with id ${gameId} not found`);
    }

    // 현재 진행 중인 상황과 선택지를 히스토리에서 확인
    if (!game.state.lastStoryProgress) {
      throw new Error(`No current situation available for selection`);
    }

    // 게임 히스토리에 상황-액션 쌍 추가
    this.addToGameHistory(game, selectedOption, selectedIndex);

    // 선택된 액션을 게임 상태에 반영
    game.state.selectedAction = {
      option: selectedOption,
      index: selectedIndex,
      timestamp: new Date(),
    };

    game.updatedAt = new Date();
    this.touchGame(gameId, game);

    return {
      game,
      nextActions: ['updateGame'], // 다음 업데이트로 체인 연결
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
    if (!game.state.story) {
      game.state.story = { progress };
    } else {
      game.state.story.progress = progress;
    }
    game.state.lastStoryProgress = progress;
    game.updatedAt = new Date();
    this.touchGame(gameId, game);
    console.error(`Game ${gameId} story progressed: ${progress}`);
    return {
      game,
      nextActions: ['promptUserActions'],
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
    game.state._currentOptions = options;

    // 현재 시간을 lastPromptTime으로 설정
    game.state._lastPromptTime = new Date();

    game.updatedAt = new Date();
    this.touchGame(gameId, game);
    console.error(`Game ${gameId} prompting user actions: ${JSON.stringify(options)}`);
    return {
      game,
      nextActions: [],
    };
  }

  /**
   * 중첩된 객체의 값을 설정하는 헬퍼 메서드
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error(`Invalid fieldSelector: path cannot be empty`);
    }

    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (this.isForbiddenKey(key)) {
        throw new Error(`SecurityError: Forbidden property access '${key}' in path '${path}'`);
      }

      if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
        // 다음 키가 숫자인지 확인하여 배열 또는 객체 생성
        const nextKey = keys[i + 1];
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (this.isForbiddenKey(lastKey)) {
      throw new Error(`SecurityError: Forbidden property access '${lastKey}' in path '${path}'`);
    }

    current[lastKey] = value;
  }

  private isForbiddenKey(key: string): boolean {
    return GameManager.FORBIDDEN_KEYS.has(key);
  }

  /**
   * 경로를 파싱하여 키 배열로 변환
   * 예: "characters[0].name" -> ["characters", "0", "name"]
   */
  private parsePath(path: string): string[] {
    if (!path || typeof path !== 'string') {
      return [];
    }

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

    for (const key of result) {
      if (this.isForbiddenKey(key)) {
        throw new Error(`SecurityError: Forbidden property access '${key}' in path '${path}'`);
      }
    }

    return result;
  }

  /**
   * 게임 히스토리에 상황-액션 쌍을 추가 (최대 10개 유지)
   */
  private addToGameHistory(game: Game, selectedOption: string, selectedIndex: number): void {
    if (!game.state._gameHistory) {
      game.state._gameHistory = [];
    }

    if (!game.state.lastStoryProgress || !game.state._currentOptions) {
      return; // 필요한 정보가 없으면 추가하지 않음
    }

    const historyEntry = {
      situation: game.state.lastStoryProgress,
      options: [...game.state._currentOptions], // 배열 복사
      selectedOption,
      selectedIndex,
      timestamp: new Date(),
    };

    game.state._gameHistory.push(historyEntry);

    // 최대 10개만 유지
    if (game.state._gameHistory.length > 10) {
      game.state._gameHistory = game.state._gameHistory.slice(-10);
    }
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

  /**
   * 특정 게임의 pending deltas 클리어
   */
  clearDeltas(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.state._pendingDeltas = [];
      this.touchGame(gameId, game);
    }
  }

  /**
   * Delta 정보를 추가하거나 업데이트
   */
  private addOrUpdateDelta(state: GameState, field: string, newValue: unknown): void {
    if (!state._pendingDeltas) {
      state._pendingDeltas = [];
    }

    // 현재 값 가져오기
    const currentValue = this.getNestedValue(state, field);

    const clonedCurrentValue =
      currentValue !== undefined && typeof currentValue === 'object' && currentValue !== null
        ? structuredClone(currentValue)
        : currentValue;
    const clonedNewValue =
      newValue !== undefined && typeof newValue === 'object' && newValue !== null
        ? structuredClone(newValue)
        : newValue;

    // 기존 delta 찾기
    const existingDeltaIndex = state._pendingDeltas.findIndex(delta => delta.field === field);

    if (existingDeltaIndex !== -1) {
      // 기존 delta 업데이트 (finalValue만 변경)
      const existingDelta = state._pendingDeltas[existingDeltaIndex];
      existingDelta.finalValue = clonedNewValue;
      existingDelta.timestamp = new Date();
      existingDelta.description = this.generateDeltaDescription(
        field,
        existingDelta.initialValue,
        clonedNewValue
      );
    } else {
      // 변경 사항이 전혀 없는 경우 델타 생성 건너뛰기
      if (JSON.stringify(currentValue) === JSON.stringify(newValue)) {
        return;
      }
      // 새 delta 추가
      const deltaInfo: DeltaInfo = {
        field,
        initialValue: clonedCurrentValue,
        finalValue: clonedNewValue,
        timestamp: new Date(),
        description: this.generateDeltaDescription(field, clonedCurrentValue, clonedNewValue),
      };
      state._pendingDeltas.push(deltaInfo);
    }
  }

  /**
   * 중첩된 객체에서 값 가져오기
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = this.parsePath(path);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;

    for (const key of keys) {
      if (this.isForbiddenKey(key)) {
        throw new Error(`SecurityError: Forbidden property access '${key}' in path '${path}'`);
      }
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Delta 설명 메시지 생성
   */
  private generateDeltaDescription(
    field: string,
    initialValue: unknown,
    finalValue: unknown
  ): string {
    // 사용자 친화적인 필드명 변환
    const friendlyFieldName = this.getFriendlyFieldName(field);

    // 값의 타입에 따른 설명 생성
    if (Array.isArray(finalValue) && Array.isArray(initialValue)) {
      const initialLength = initialValue.length;
      const finalLength = finalValue.length;
      if (finalLength > initialLength) {
        return `${friendlyFieldName}: ${finalLength - initialLength} item(s) added`;
      } else if (finalLength < initialLength) {
        return `${friendlyFieldName}: ${initialLength - finalLength} item(s) removed`;
      } else {
        return `${friendlyFieldName}: contents changed`;
      }
    } else if (typeof finalValue === 'number' && typeof initialValue === 'number') {
      const change = finalValue - initialValue;
      if (change > 0) {
        return `${friendlyFieldName}: increased by ${change} (${initialValue} → ${finalValue})`;
      } else if (change < 0) {
        return `${friendlyFieldName}: decreased by ${Math.abs(change)} (${initialValue} → ${finalValue})`;
      } else {
        return `${friendlyFieldName}: unchanged (${finalValue})`;
      }
    } else {
      return `${friendlyFieldName}: changed from ${JSON.stringify(initialValue)} to ${JSON.stringify(finalValue)}`;
    }
  }

  /**
   * 사용자 친화적인 필드명 반환
   */
  private getFriendlyFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      characters: 'Character',
      world: 'World',
      inventory: 'Inventory',
      story: 'Story',
      title: 'Title',
      hp: 'HP',
      mp: 'MP',
      level: 'Level',
      favorability: 'Favorability',
      location: 'Location',
      time: 'Time',
      weather: 'Weather',
    };

    // 배열 인덱스나 중첩 경로 처리
    const parts = field.split(/[.[\]]/);
    const mainField = parts[0];

    return fieldMap[mainField] || mainField;
  }
}
