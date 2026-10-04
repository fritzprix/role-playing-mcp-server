import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '../src/gameManager.js';
import type { GameState } from '../src/types.js';

describe('GameManager', () => {
  let gm: GameManager;

  beforeEach(() => {
    gm = new GameManager(10);
  });

  describe('createGame', () => {
    it('creates a game from an object', () => {
      const initialState: GameState = {
        title: 'Fantasy Adventure',
        characters: [{ name: 'Hero', hp: 100 }],
        world: { location: 'Starting Village' },
      };

      const response = gm.createGame(initialState);
      expect(response.game).toBeDefined();
      expect(response.game.gameId).toBeDefined();
      expect(response.game.state.title).toBe('Fantasy Adventure');
      expect(response.game.createdAt).toBeInstanceOf(Date);
      expect(response.game.updatedAt).toBeInstanceOf(Date);
      expect(response.nextActions).toEqual(['progressStory']);
    });

    it('creates a game from a valid JSON string', () => {
      const stateJson = JSON.stringify({
        title: 'Sci-Fi Odyssey',
        world: { location: 'Starship' },
      });

      const response = gm.createGame(stateJson);
      expect(response.game.state.title).toBe('Sci-Fi Odyssey');
    });

    it('throws an error for invalid JSON string', () => {
      expect(() => gm.createGame('{ invalid json')).toThrow('Invalid JSON string for initialState');
    });

    it('throws error when maxGames is not a positive integer', () => {
      expect(() => new GameManager(0)).toThrow('maxGames must be a positive integer');
      expect(() => new GameManager(-5)).toThrow('maxGames must be a positive integer');
      expect(() => new GameManager(1.5)).toThrow('maxGames must be a positive integer');
    });

    it('isolates game state from caller mutations via structuredClone', () => {
      const initialState: GameState = {
        title: 'Original Title',
        world: { location: 'Safe Town' },
      };

      const response = gm.createGame(initialState);
      initialState.title = 'MUTATED Title';
      if (initialState.world) {
        initialState.world.location = 'HACKED Location';
      }

      expect(response.game.state.title).toBe('Original Title');
      expect(response.game.state.world?.location).toBe('Safe Town');
    });

    it('rejects non-object or array inputs for initialState', () => {
      expect(() => gm.createGame('null')).toThrow('initialState must be a non-null plain object');
      expect(() => gm.createGame('[1, 2, 3]')).toThrow(
        'initialState must be a non-null plain object'
      );
      expect(() => gm.createGame('"plain string"')).toThrow(
        'initialState must be a non-null plain object'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => gm.createGame(null as any)).toThrow(
        'initialState must be a non-null plain object'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => gm.createGame([] as any)).toThrow(
        'initialState must be a non-null plain object'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => gm.createGame(new Date() as any)).toThrow(
        'initialState must be a non-null plain object'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => gm.createGame(/regex/ as any)).toThrow(
        'initialState must be a non-null plain object'
      );
      class CustomClass {
        title = 'custom';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => gm.createGame(new CustomClass() as any)).toThrow(
        'initialState must be a non-null plain object'
      );

      // Object.create(null) should be accepted as a valid plain object
      const nullProtoObj = Object.create(null);
      nullProtoObj.title = 'Null Proto Game';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nullRes = gm.createGame(nullProtoObj as any);
      expect(nullRes.game.state.title).toBe('Null Proto Game');
    });

    it('implements true LRU eviction (accessing a game protects it from eviction)', () => {
      const smallGm = new GameManager(2);
      const game1 = smallGm.createGame({ title: 'Game 1' });
      const game2 = smallGm.createGame({ title: 'Game 2' });

      // Access Game 1 via getGame -> Game 1 becomes most recently used
      smallGm.getGame(game1.game.gameId);

      // Create Game 3 -> Game 2 (least recently used) should be evicted, Game 1 and Game 3 remain
      const game3 = smallGm.createGame({ title: 'Game 3' });

      expect(smallGm.getAllGames().length).toBe(2);
      expect(() => smallGm.getGame(game2.game.gameId)).toThrow();
      expect(smallGm.getGame(game1.game.gameId).game.state.title).toBe('Game 1');
      expect(smallGm.getGame(game3.game.gameId).game.state.title).toBe('Game 3');
    });

    it('evicts the oldest game when maxGames limit is reached without access', () => {
      const smallGm = new GameManager(2);
      const game1 = smallGm.createGame({ title: 'Game 1' });
      const game2 = smallGm.createGame({ title: 'Game 2' });
      const game3 = smallGm.createGame({ title: 'Game 3' });

      expect(smallGm.getAllGames().length).toBe(2);
      expect(() => smallGm.getGame(game1.game.gameId)).toThrow();
      expect(smallGm.getGame(game2.game.gameId).game.state.title).toBe('Game 2');
      expect(smallGm.getGame(game3.game.gameId).game.state.title).toBe('Game 3');
    });
  });

  describe('Security: Prototype Pollution Guards', () => {
    it('blocks __proto__ pollution in updateGame', () => {
      const res = gm.createGame({ title: 'Security Test' });
      expect(() => {
        gm.updateGame(res.game.gameId, '__proto__.polluted', true);
      }).toThrow(/SecurityError/);

      // Verify Object.prototype is not polluted
      const plainObj: Record<string, unknown> = {};
      expect(plainObj.polluted).toBeUndefined();
    });

    it('blocks constructor.prototype pollution in updateGame', () => {
      const res = gm.createGame({ title: 'Security Test' });
      expect(() => {
        gm.updateGame(res.game.gameId, 'constructor.prototype.polluted', true);
      }).toThrow(/SecurityError/);

      const plainObj: Record<string, unknown> = {};
      expect(plainObj.polluted).toBeUndefined();
    });

    it('blocks prototype pollution in updateGame', () => {
      const res = gm.createGame({ title: 'Security Test' });
      expect(() => {
        gm.updateGame(res.game.gameId, 'prototype.polluted', true);
      }).toThrow(/SecurityError/);
    });
  });

  describe('updateGame & State Immutability', () => {
    it('updates top-level properties', () => {
      const res = gm.createGame({ title: 'Old Title' });
      const updated = gm.updateGame(res.game.gameId, 'title', 'New Title');
      expect(updated.game.state.title).toBe('New Title');
    });

    it('updates nested properties and paths with game. prefix', () => {
      const res = gm.createGame({ title: 'Test', world: { location: 'Town' } });
      const updated = gm.updateGame(res.game.gameId, 'game.world.location', 'Dungeon');
      expect(updated.game.state.world?.location).toBe('Dungeon');
    });

    it('updates array elements using bracket notation', () => {
      const res = gm.createGame({
        title: 'Test',
        characters: [{ name: 'Hero', hp: 100 }],
      });
      const updated = gm.updateGame(res.game.gameId, 'characters[0].hp', 85);
      expect(updated.game.state.characters?.[0].hp).toBe(85);
    });

    it('creates intermediate objects/arrays when path does not exist', () => {
      const res = gm.createGame({ title: 'Test' });
      const updated = gm.updateGame(res.game.gameId, 'party.members[0].name', 'Warrior');
      expect(updated.game.state.party.members[0].name).toBe('Warrior');
    });

    it('throws when fieldSelector is empty', () => {
      const res = gm.createGame({ title: 'Test' });
      expect(() => gm.updateGame(res.game.gameId, '', 'value')).toThrow(
        'fieldSelector parameter cannot be empty'
      );
      expect(() => gm.updateGame(res.game.gameId, '   ', 'value')).toThrow(
        'fieldSelector parameter cannot be empty'
      );
      expect(() => gm.updateGame(res.game.gameId, 'game.', 'value')).toThrow(
        'fieldSelector parameter cannot be empty'
      );
    });

    it('preserves Date instances through structuredClone', () => {
      const res = gm.createGame({ title: 'Date Test' });
      gm.progressStory(res.game.gameId, 'Prologue');
      gm.promptUserActions(res.game.gameId, ['Option A', 'Option B']);
      gm.selectAction(res.game.gameId, 'Option A', 0);

      expect(res.game.state.selectedAction?.timestamp).toBeInstanceOf(Date);

      const updated = gm.updateGame(res.game.gameId, 'title', 'Updated Date Test');
      expect(updated.game.state.selectedAction?.timestamp).toBeInstanceOf(Date);
      expect(updated.game.state._lastPromptTime).toBeInstanceOf(Date);
    });
  });

  describe('Delta System', () => {
    it('records numeric increases and decreases accurately', () => {
      const res = gm.createGame({ title: 'Test', hp: 100 });
      gm.updateGame(res.game.gameId, 'hp', 120);

      let deltas = res.game.state._pendingDeltas || [];
      expect(deltas.length).toBe(1);
      expect(deltas[0].description).toBe('HP: increased by 20 (100 → 120)');

      gm.updateGame(res.game.gameId, 'hp', 90);
      deltas = res.game.state._pendingDeltas || [];
      expect(deltas.length).toBe(1); // consolidated
      expect(deltas[0].description).toBe('HP: decreased by 10 (100 → 90)');
    });

    it('does not create redundant delta when updated value is identical to initial', () => {
      const res = gm.createGame({ title: 'Test', hp: 100 });
      gm.updateGame(res.game.gameId, 'hp', 100);
      const deltas = res.game.state._pendingDeltas || [];
      expect(deltas.length).toBe(0);
    });

    it('clears deltas when clearDeltas is called', () => {
      const res = gm.createGame({ title: 'Test', hp: 100 });
      gm.updateGame(res.game.gameId, 'hp', 90);
      expect((res.game.state._pendingDeltas || []).length).toBe(1);

      gm.clearDeltas(res.game.gameId);
      expect(res.game.state._pendingDeltas).toEqual([]);
    });
  });

  describe('Game Loop & History', () => {
    it('manages narrative progress and user choices', () => {
      const res = gm.createGame({ title: 'Adventure' });
      const gameId = res.game.gameId;

      const progress = gm.progressStory(gameId, 'You stand before a dark dungeon.');
      expect(progress.game.state.story?.progress).toBe('You stand before a dark dungeon.');
      expect(progress.game.state.lastStoryProgress).toBe('You stand before a dark dungeon.');

      const prompt = gm.promptUserActions(gameId, ['Enter dungeon', 'Turn back']);
      expect(prompt.game.state._currentOptions).toEqual(['Enter dungeon', 'Turn back']);

      const selected = gm.selectAction(gameId, 'Enter dungeon', 0);
      expect(selected.game.state.selectedAction?.option).toBe('Enter dungeon');
      expect(selected.game.state._gameHistory?.length).toBe(1);
      expect(selected.game.state._gameHistory?.[0].selectedOption).toBe('Enter dungeon');
    });

    it('keeps maximum of 10 history entries', () => {
      const res = gm.createGame({ title: 'Long Game' });
      const gameId = res.game.gameId;

      for (let i = 0; i < 15; i++) {
        gm.progressStory(gameId, `Situation ${i}`);
        gm.promptUserActions(gameId, [`Option ${i}A`, `Option ${i}B`]);
        gm.selectAction(gameId, `Option ${i}A`, 0);
      }

      expect(res.game.state._gameHistory?.length).toBe(10);
      expect(res.game.state._gameHistory?.[0].situation).toBe('Situation 5');
      expect(res.game.state._gameHistory?.[9].situation).toBe('Situation 14');
    });
  });
});
