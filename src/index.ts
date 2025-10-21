#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { GameManager } from './gameManager.js';
import {
  CreateGameParams,
  UpdateGameParams,
  GetGameParams,
  ProgressStoryParams,
  PromptUserActionsParams,
  SelectActionParams,
  SelectRestartParams,
  ErrorResponse,
  DeltaInfo,
  GameHistoryEntry,
  GameState,
} from './types.js';

/**
 * RPG 게임 MCP 서버
 * 5개의 Tool 제공: createGame, updateGame, getGame, progressStory, promptUserActions
 */
class RPGMCPServer {
  private server: Server;
  private gameManager: GameManager;

  constructor() {
    this.server = new Server(
      {
        name: 'rpg-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.gameManager = new GameManager();
    this.setupHandlers();
  }

  /**
   * HTML 이스케이프 - XSS 방지
   */
  private escapeHtml(input: unknown): string {
    const s = String(input ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 게임 상태 요약 생성
   */
  private generateGameStateSummary(state: GameState): string {
    return `
      <div class="state-item">👤 Characters: ${state.characters?.length || 0}</div>
      <div class="state-item">📍 Location: ${this.escapeHtml(state.world?.location || 'Unknown')}</div>
      <div class="state-item">📖 Story: ${this.escapeHtml(state.story?.progress || 'N/A')}</div>
      <div class="state-item">🎒 Items: ${state.inventory?.length || 0}</div>
    `;
  }

  private setupHandlers(): void {
    // Tool 호출 처리
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments || {};

      console.error(`Tool called: ${toolName}`, toolArgs); // 디버깅용 로그

      try {
        let result: CallToolResult;

        switch (toolName) {
          case 'createGame':
            result = await this.handleCreateGame(toolArgs as unknown as CreateGameParams);
            break;
          case 'updateGame':
            result = await this.handleUpdateGame(toolArgs as unknown as UpdateGameParams);
            break;
          case 'getGame':
            result = await this.handleGetGame(toolArgs as unknown as GetGameParams);
            break;
          case 'progressStory':
            result = await this.handleProgressStory(toolArgs as unknown as ProgressStoryParams);
            break;
          case 'promptUserActions':
            result = await this.handlePromptUserActions(
              toolArgs as unknown as PromptUserActionsParams
            );
            break;
          case 'selectAction':
            result = await this.handleSelectAction(toolArgs as unknown as SelectActionParams);
            break;
          case 'selectRestart':
            result = await this.handleSelectRestart(toolArgs as unknown as SelectRestartParams);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        console.error(`Tool ${toolName} executed successfully`); // 성공 로그

        return result;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error('Tool execution error:', {
          name: toolName,
          args: toolArgs,
          error: error.message,
          stack: error.stack,
        });

        const errorResponse: ErrorResponse = {
          error: error.message,
          tool: toolName,
          timestamp: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResponse, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // 사용 가능한 Tool 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'createGame',
            description:
              'Create a new RPG game with complete initial state. Returns the created game with assigned gameId. Use updateGame or progressStory next to continue the game flow.',
            inputSchema: {
              type: 'object',
              properties: {
                initialStateInJson: {
                  type: 'object',
                  description:
                    'Complete game state object. Must include title, characters array, and game world settings. Example: {"title": "Fantasy Adventure", "characters": [{"name": "Hero", "level": 1, "hp": 100}], "world": {"location": "Village", "time": "morning"}}',
                  examples: [
                    {
                      title: 'Fantasy Adventure',
                      characters: [{ name: 'Hero', level: 1, hp: 100, mp: 50, class: 'Warrior' }],
                      world: { location: 'Starting Village', time: 'morning', weather: 'sunny' },
                      inventory: [],
                      story: { chapter: 1, progress: 'beginning' },
                    },
                  ],
                },
              },
              required: ['initialStateInJson'],
            },
          },
          {
            name: 'updateGame',
            description:
              'Update a specific field in the game state and return the complete updated game state. Supports nested property updates using path notation. If the update results in game over (e.g., character HP reaches 0, story reaches bad ending), set isGameOver=true. Use progressStory next to advance the narrative.',
            inputSchema: {
              type: 'object',
              properties: {
                gameId: {
                  type: 'string',
                  description: 'ID of the game to update',
                },
                fieldSelector: {
                  type: 'string',
                  description:
                    "Path to the field to update. Examples: 'characters[0].level', 'world.time', 'player.stats.hp', 'characters[1].favorability'",
                },
                value: {
                  type: ['string', 'number', 'object', 'array', 'boolean', 'null'],
                  description:
                    'New value to set (supports all types: string, number, object, array, boolean, null)',
                  examples: [
                    5,
                    'new location',
                    { hp: 100, mp: 50 },
                    ['item1', 'item2'],
                    true,
                    null,
                  ],
                },
                isGameOver: {
                  type: 'boolean',
                  description:
                    'Set to true if this update results in game over condition (e.g., character death, bad ending reached)',
                },
                gameOverReason: {
                  type: 'string',
                  description:
                    'Explanation of why the game ended when isGameOver is true. Should be empathetic and include what could have been done differently.',
                },
              },
              required: ['gameId', 'fieldSelector', 'value'],
            },
          },
          {
            name: 'getGame',
            description:
              'Retrieve the complete current state of a game by its ID. Use this tool anytime to inspect the game state.',
            inputSchema: {
              type: 'object',
              properties: {
                gameId: {
                  type: 'string',
                  description: 'ID of the game to retrieve',
                },
              },
              required: ['gameId'],
            },
          },
          {
            name: 'progressStory',
            description:
              'Advance the game narrative and set the current story progress. This tool should be called after createGame or updateGame. Use promptUserActions next to present choices to the user.',
            inputSchema: {
              type: 'object',
              properties: {
                gameId: {
                  type: 'string',
                  description: 'ID of the game to progress',
                },
                progress: {
                  type: 'string',
                  description:
                    'Description of the current story progress or event. Should describe what happens next in the narrative.',
                },
              },
              required: ['gameId', 'progress'],
            },
          },
          {
            name: 'promptUserActions',
            description: `Present the user with 2-4 meaningful action options that MIX POSITIVE AND NEGATIVE OUTCOMES for dynamic, engaging gameplay. Each option should offer distinct consequences and risk/reward tradeoffs. This tool should be called after progressStory to complete the story cycle and wait for user input. Use selectAction next after the user selects an option.

IMPORTANT: Create options that vary in approach and consequences:
- Include both favorable and unfavorable outcome possibilities
- Offer cautious vs risky strategies
- Provide different character alignment choices
- Ensure options feel contextually relevant to the current situation`,
            inputSchema: {
              type: 'object',
              properties: {
                gameId: {
                  type: 'string',
                  description: 'ID of the game to prompt',
                },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: `List of 2-4 action options with mixed positive/negative consequences. Each option should:
- React to the current story situation
- Have distinct potential outcomes (some favorable, some risky/unfavorable)
- Range from cautious to daring approaches
- Align with character abilities and game state

Example: ["Approach the stranger cautiously and chat (might gather info or be deceived)", "Attack preemptively (risky but decisive)", "Search for another route (safer but takes time)", "Hide and observe (tactical but limits information)"]`,
                  minItems: 2,
                  maxItems: 4,
                },
              },
              required: ['gameId', 'options'],
            },
          },
          {
            name: 'selectAction',
            description:
              "Process the user's selected action from the UI and continue the game flow. This tool should be called after promptUserActions when the user makes a selection. Use updateGame next to reflect the result of the action.",
            inputSchema: {
              type: 'object',
              properties: {
                gameId: { type: 'string', description: 'ID of the game' },
                selectedOption: { type: 'string', description: 'The option text user selected' },
                selectedIndex: {
                  type: 'number',
                  description: 'Index of selected option (0-based)',
                },
              },
              required: ['gameId', 'selectedOption', 'selectedIndex'],
            },
          },
          {
            name: 'selectRestart',
            description:
              'Restart the game after game over. Retrieves final game state summary and instructs to create a new game. This should be called when the player clicks the Restart button on the Game Over screen.',
            inputSchema: {
              type: 'object',
              properties: {
                gameId: {
                  type: 'string',
                  description: 'ID of the ended game',
                },
              },
              required: ['gameId'],
            },
          },
        ],
      };
    });
  }

  /**
   * Format a human-readable response for AI agent
   */
  private formatToolResponse(
    toolName: string,
    status: 'success' | 'error',
    summary: string,
    gameContext: {
      gameId: string;
      title?: string;
      keyState?: string[];
    },
    actionTaken: string,
    nextStep: {
      tool: string;
      reason: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: Record<string, any>;
    } | null,
    workflowPosition: string,
    additionalNotes?: string[]
  ): string {
    const statusEmoji = status === 'success' ? '✅' : '❌';

    let response = `${statusEmoji} ${toolName} ${status === 'success' ? 'Completed Successfully' : 'Failed'}\n\n`;

    response += `📋 Game Context:\n`;
    response += `- Game ID: ${gameContext.gameId}\n`;
    if (gameContext.title) response += `- Title: ${gameContext.title}\n`;
    if (gameContext.keyState) {
      gameContext.keyState.forEach(state => (response += `- ${state}\n`));
    }
    response += `\n`;

    response += `📝 What Happened:\n${actionTaken}\n\n`;

    if (nextStep) {
      response += `🎯 Next Step:\n`;
      response += `Call the '${nextStep.tool}' tool with these parameters:\n`;
      Object.entries(nextStep.params).forEach(([key, value]) => {
        response += `- ${key}: ${JSON.stringify(value)}\n`;
      });
      response += `\nReason: ${nextStep.reason}\n\n`;
    } else {
      response += `⏸️ Status:\nWaiting for user input. No action required until player makes a selection.\n\n`;
    }

    response += `💡 Workflow: ${workflowPosition}\n`;

    if (additionalNotes && additionalNotes.length > 0) {
      response += `\n📌 Additional Notes:\n`;
      additionalNotes.forEach(note => (response += `- ${note}\n`));
    }

    return response;
  }

  private async handleCreateGame(params: CreateGameParams): Promise<CallToolResult> {
    if (!params.initialStateInJson) {
      throw new Error('initialStateInJson parameter is required');
    }
    const result = this.gameManager.createGame(params.initialStateInJson);

    const responseText = this.formatToolResponse(
      'createGame',
      'success',
      `New game created with ID: ${result.game.gameId}`,
      {
        gameId: result.game.gameId,
        title: result.game.state.title,
        keyState: [
          `Characters: ${result.game.state.characters?.length || 0}`,
          `Location: ${result.game.state.world?.location || 'Unknown'}`,
          `Created: ${result.game.createdAt.toISOString()}`,
        ],
      },
      `Initialized game world with provided state including characters, world settings, and inventory.`,
      {
        tool: 'progressStory',
        reason:
          'Begin the narrative by describing the opening scene and establishing story context',
        params: {
          gameId: result.game.gameId,
          progress: 'Describe the opening situation, setting, and initial scenario for the player',
        },
      },
      'Step 1/5: [createGame] → progressStory → promptUserActions → selectAction → updateGame'
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  private async handleUpdateGame(params: UpdateGameParams): Promise<CallToolResult> {
    if (!params.gameId || !params.fieldSelector || params.value === undefined) {
      throw new Error('gameId, fieldSelector, and value parameters are required');
    }
    const result = this.gameManager.updateGame(params.gameId, params.fieldSelector, params.value);

    // Game Over 처리
    if (params.isGameOver && params.gameOverReason) {
      const gameOverHtml = this.generateGameOverUI(
        params.gameId,
        params.gameOverReason,
        result.game.state
      );

      const gameOverResource = {
        type: 'resource' as const,
        resource: {
          uri: `ui://rpg-game/${params.gameId}/game-over`,
          mimeType: 'text/html',
          text: gameOverHtml,
          _meta: {
            title: 'Game Over',
            description: `Game over screen for ${params.gameId}`,
            preferredRenderContext: 'main',
          },
        },
      };

      const responseText = this.formatToolResponse(
        'updateGame',
        'success',
        `Game Over - ${params.gameOverReason}`,
        {
          gameId: params.gameId,
          title: result.game.state.title,
          keyState: [
            `Updated field: ${params.fieldSelector}`,
            `Final value: ${JSON.stringify(params.value)}`,
            'Game Status: ENDED',
          ],
        },
        `The game has ended. The story has reached its conclusion with: ${params.gameOverReason}`,
        null, // No next step - game is over
        'Game Over - Story Concluded',
        [
          '🎮 The journey has ended',
          `Reason: ${params.gameOverReason}`,
          'Consider starting a new game to explore different outcomes',
          'Your choices shaped this story to its conclusion',
        ]
      );

      return {
        content: [gameOverResource, { type: 'text', text: responseText }],
      };
    }

    // 정상 진행
    const deltas = result.game.state._pendingDeltas || [];
    const deltaDescriptions = deltas.map(d => d.description).join('; ');

    const responseText = this.formatToolResponse(
      'updateGame',
      'success',
      `Updated ${params.fieldSelector} to ${JSON.stringify(params.value)}`,
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Updated field: ${params.fieldSelector}`,
          `New value: ${JSON.stringify(params.value)}`,
          `Pending changes: ${deltas.length}`,
        ],
      },
      `Game state modified. Changes: ${deltaDescriptions || 'State updated'}`,
      {
        tool: 'progressStory',
        reason: 'Narrate the consequences and outcomes of this state change in the story',
        params: {
          gameId: params.gameId,
          progress: `Describe how the change to ${params.fieldSelector} affects the game world, characters, and situation`,
        },
      },
      'Step 5/5: createGame → progressStory → promptUserActions → selectAction → updateGame → [progressStory]',
      [
        'You may call updateGame multiple times to apply multiple changes',
        'Call progressStory after all updates to narrate the cumulative results',
        `${deltas.length} change(s) will be displayed to player on next promptUserActions`,
      ]
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  private async handleGetGame(params: GetGameParams): Promise<CallToolResult> {
    if (!params.gameId) {
      throw new Error('gameId parameter is required');
    }
    const result = this.gameManager.getGame(params.gameId);

    // Analyze state to determine next action
    const hasStory = !!result.game.state.lastStoryProgress;
    const hasOptions = !!result.game.state._currentOptions;
    const hasSelection = !!result.game.state.selectedAction;

    let nextStep = null;
    if (hasOptions && !hasSelection) {
      // Waiting for player selection
      nextStep = null;
    } else if (hasSelection) {
      nextStep = {
        tool: 'updateGame',
        reason: `Apply consequences of selected action: "${result.game.state.selectedAction?.option}"`,
        params: {
          gameId: params.gameId,
          fieldSelector: 'Determine which field to update based on the selected action',
          value: 'Calculate new value based on action outcome',
        },
      };
    } else if (hasStory) {
      nextStep = {
        tool: 'promptUserActions',
        reason: 'Present choices to player based on current story state',
        params: {
          gameId: params.gameId,
          options: ['Create 2-4 meaningful choices based on current situation'],
        },
      };
    } else {
      nextStep = {
        tool: 'progressStory',
        reason: 'Begin or advance the narrative',
        params: {
          gameId: params.gameId,
          progress: 'Describe the current situation and setting',
        },
      };
    }

    const responseText = this.formatToolResponse(
      'getGame',
      'success',
      `Retrieved game state for: ${result.game.state.title}`,
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Characters: ${result.game.state.characters?.length || 0}`,
          `Location: ${result.game.state.world?.location || 'Unknown'}`,
          `Story: ${result.game.state.story?.progress || 'Not started'}`,
          `Last updated: ${result.game.updatedAt.toISOString()}`,
        ],
      },
      `Retrieved complete game state for inspection. Current status: ${hasOptions ? 'Awaiting player choice' : 'Ready for progression'}`,
      nextStep,
      'Inspection mode - use retrieved state to determine next action',
      [
        'This is a read-only operation',
        `Story progress: ${hasStory ? 'Active' : 'Not started'}`,
        `Player options: ${hasOptions ? 'Presented' : 'None'}`,
        `Player selection: ${hasSelection ? 'Made' : 'Pending'}`,
      ]
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  private async handleProgressStory(params: ProgressStoryParams): Promise<CallToolResult> {
    if (!params.gameId || typeof params.progress !== 'string') {
      throw new Error('gameId and progress parameters are required');
    }
    const result = this.gameManager.progressStory(params.gameId, params.progress);

    const deltas = result.game.state._pendingDeltas || [];

    const responseText = this.formatToolResponse(
      'progressStory',
      'success',
      `Story advanced: "${params.progress.substring(0, 60)}${params.progress.length > 60 ? '...' : ''}"`,
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Chapter: ${result.game.state.story?.chapter || 'N/A'}`,
          `Location: ${result.game.state.world?.location || 'Unknown'}`,
          `Pending deltas: ${deltas.length}`,
        ],
      },
      `Narrative advanced. Current situation: "${params.progress}"`,
      {
        tool: 'promptUserActions',
        reason:
          'Present player with 2-4 choices that mix positive and negative outcomes for dynamic gameplay',
        params: {
          gameId: params.gameId,
          options: [
            'Create 2-4 meaningful options that:',
            '- MIX positive AND negative outcomes (risk/reward tradeoffs)',
            '- Offer both cautious AND daring approaches',
            '- Include favorable and unfavorable possibilities',
            '- React to the current situation',
            '- Align with character abilities and game state',
          ],
        },
      },
      'Step 2/5: createGame → [progressStory] → promptUserActions → selectAction → updateGame',
      [
        'Players need diverse choices with varying consequences for engaging gameplay',
        `${deltas.length} pending change(s) will be displayed in the next UI`,
        'Ensure options provide both safe and risky alternatives',
        'Avoid making all options have similar outcomes',
      ]
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  private async handlePromptUserActions(params: PromptUserActionsParams): Promise<CallToolResult> {
    if (!params.gameId || !Array.isArray(params.options)) {
      throw new Error('gameId and options parameters are required');
    }
    if (params.options.length === 0) {
      throw new Error('options array cannot be empty');
    }
    const result = this.gameManager.promptUserActions(params.gameId, params.options);

    // UI 리소스를 수동으로 생성 (mimeType 포함)
    const uiHtml = this.generateGameUI(
      result.game.state.lastStoryProgress || '게임이 시작됩니다...',
      params.options,
      params.gameId
    );

    // Delta clear
    this.gameManager.clearDeltas(params.gameId);

    const uiResource = {
      type: 'resource' as const,
      resource: {
        uri: `ui://rpg-game/${params.gameId}/actions`,
        mimeType: 'text/html',
        text: uiHtml,
        _meta: {
          title: 'RPG Game Actions',
          description: `Action selection for game ${params.gameId}`,
          preferredRenderContext: 'main',
        },
      },
    };

    const responseText = this.formatToolResponse(
      'promptUserActions',
      'success',
      `Presented ${params.options.length} choices to player with mixed outcomes`,
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Situation: "${result.game.state.lastStoryProgress}"`,
          `Options presented: ${params.options.length}`,
          `Deltas displayed and cleared`,
        ],
      },
      `Interactive UI generated with story progress and ${params.options.length} action buttons. Options mix positive and negative outcomes for dynamic gameplay. Player can now make a selection.`,
      null, // No next step - waiting for user
      'Step 3/5: createGame → progressStory → [promptUserActions] → WAITING FOR USER → selectAction',
      [
        'PAUSED: Waiting for player to select an option via UI',
        'selectAction will be called automatically when player clicks a button',
        'Do not proceed until selectAction is invoked',
        `Options presented: ${params.options.map((o, i) => `[${i}] ${o}`).join('; ')}`,
      ]
    );

    return {
      content: [uiResource, { type: 'text', text: responseText }],
    };
  }

  /**
   * 게임 UI HTML 생성
   */
  private generateGameUI(storyProgress: string, options: string[], gameId: string): string {
    // 게임 상태에서 pendingDeltas 가져오기
    const game = this.gameManager.getGame(gameId).game;
    const pendingDeltas = game.state._pendingDeltas || [];

    // Delta 섹션 HTML 생성
    const deltaSection = this.generateDeltaSection(pendingDeltas);

    // XSS 방지를 위한 안전한 값 처리
    const safeGameId = this.escapeHtml(gameId);
    const safeStoryProgress = this.escapeHtml(storyProgress);

    const optionButtons = options
      .map((option, index) => {
        const safeOption = this.escapeHtml(option);
        return `
      <button 
        class="action-button"
        data-gameid="${safeGameId}"
        data-option="${safeOption}"
        data-index="${index}"
      >
        ${safeOption}
      </button>
    `;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RPG Game</title>
    <style>
        * {
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            overflow-x: hidden;
            padding: 10px;
        }
        .game-container {
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .story-section {
            background: #f8f9fa;
            border-left: 5px solid #667eea;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 5px;
            font-size: 16px;
            line-height: 1.6;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .actions-section h3 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 18px;
        }
        .delta-section {
            background: #fff3cd;
            border-left: 5px solid #ffc107;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 5px;
            animation: slideIn 0.5s ease-in;
        }
        .delta-section h3 {
            color: #856404;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .delta-item {
            background: #ffffff;
            padding: 10px 15px;
            margin-bottom: 8px;
            border-radius: 5px;
            border-left: 3px solid #ffc107;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .delta-item:last-child {
            margin-bottom: 0;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .action-button {
            display: block;
            width: 100%;
            padding: 15px 20px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: left;
        }
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .action-button:active {
            transform: translateY(0);
        }
        .game-id {
            color: #666;
            font-size: 12px;
            text-align: center;
            margin-top: 20px;
            word-break: break-all;
        }
        @media (max-width: 480px) {
            body {
                padding: 5px;
            }
            .game-container {
                padding: 15px;
            }
            .story-section {
                padding: 15px;
                font-size: 14px;
            }
            .action-button {
                padding: 12px 15px;
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="game-container">
        <div class="story-section">
            ${safeStoryProgress}
        </div>
        
        ${deltaSection}
        
        <div class="actions-section">
            <h3>🎯 선택하세요:</h3>
            ${optionButtons}
        </div>
        
        <div class="game-id">Game ID: ${safeGameId}</div>
    </div>

    <script>
        (function() {
            const buttons = document.querySelectorAll('.action-button');
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const gameId = btn.dataset.gameid;
                    const selectedOption = btn.dataset.option;
                    const selectedIndex = parseInt(btn.dataset.index, 10);
                    
                    // 선택된 버튼 하이라이트
                    buttons.forEach(b => b.style.opacity = '0.5');
                    btn.style.opacity = '1';
                    btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                    
                    // MCP 도구 호출을 위한 postMessage
                    window.parent.postMessage({
                        type: 'tool',
                        payload: {
                            toolName: 'selectAction',
                            params: {
                                gameId: gameId,
                                selectedOption: selectedOption,
                                selectedIndex: selectedIndex
                            }
                        }
                    }, '*');
                });
            });
        })();
    </script>
</body>
</html>`;
  }

  private generateGameOverUI(gameId: string, gameOverReason: string, gameState: GameState): string {
    const safeGameId = this.escapeHtml(gameId);
    const safeReason = this.escapeHtml(gameOverReason);
    const safeJsonSummary = this.generateGameStateSummary(gameState);
    const safeJsonFull = this.escapeHtml(JSON.stringify(gameState, null, 2));

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Over</title>
    <style>
        * {
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: #ecf0f1;
            overflow-x: hidden;
            padding: 10px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
        }
        .game-over-container {
            width: 100%;
            max-width: 600px;
            margin-top: 20px;
            padding: 20px;
            background: #2c3e50;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 3px solid #e74c3c;
            text-align: center;
            animation: fadeIn 0.8s ease-in;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        .game-over-title {
            font-size: 48px;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            animation: blink 1.5s infinite;
        }
        @keyframes blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.7; }
        }
        .game-over-reason {
            background: #e74c3c;
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            color: #ecf0f1;
            font-size: 16px;
            line-height: 1.6;
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .game-over-reason h3 {
            color: #fff;
            margin: 0 0 10px 0;
            font-size: 18px;
            text-align: center;
        }
        .final-state-summary {
            background: #34495e;
            border: 1px solid #7f8c8d;
            border-radius: 8px;
            padding: 12px;
            margin: 15px 0;
            font-size: 13px;
            color: #bdc3c7;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            text-align: left;
        }
        .state-item {
            padding: 5px;
        }
        details {
            margin: 15px 0;
            text-align: left;
        }
        details summary {
            cursor: pointer;
            color: #2ecc71;
            font-weight: bold;
            user-select: none;
            padding: 5px;
        }
        details summary:hover {
            color: #27ae60;
        }
        .final-state-content {
            background: #1a252f;
            border: 1px solid #555;
            border-radius: 5px;
            padding: 10px;
            margin-top: 10px;
            overflow-x: auto;
            overflow-y: auto;
            max-height: 250px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 12px;
            line-height: 1.4;
        }
        .retry-message {
            color: #ecf0f1;
            font-size: 14px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #7f8c8d;
        }
        .restart-button-section {
            margin-top: 20px;
            text-align: center;
        }
        .restart-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 30px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .restart-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.6);
        }
        .restart-button:active {
            transform: translateY(0);
        }
        .restart-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .game-id {
            color: #95a5a6;
            font-size: 11px;
            text-align: center;
            margin-top: 15px;
            word-break: break-all;
        }
        @media (max-width: 480px) {
            body {
                padding: 5px;
            }
            .game-over-container {
                padding: 15px;
                margin-top: 10px;
            }
            .game-over-title {
                font-size: 32px;
                margin-bottom: 10px;
            }
            .game-over-reason {
                padding: 12px;
                font-size: 14px;
            }
            .final-state-summary {
                grid-template-columns: 1fr;
                font-size: 12px;
            }
            .restart-button {
                padding: 10px 20px;
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="game-over-container">
        <div class="game-over-title">☠️ GAME OVER ☠️</div>
        
        <div class="game-over-reason">
            <h3>무엇이 일어났나요?</h3>
            <p>${safeReason}</p>
        </div>
        
        <div class="final-state-summary">
            ${safeJsonSummary}
        </div>

        <details>
            <summary>� 전체 게임 상태 보기</summary>
            <div class="final-state-content">${safeJsonFull}</div>
        </details>
        
        <div class="retry-message">
            🎮 새로운 게임으로 다시 시작하고, 다른 선택들을 시도해보세요!
        </div>

        <div class="restart-button-section">
            <button 
                id="restart-btn"
                class="restart-button"
                data-gameid="${safeGameId}"
                type="button"
                aria-label="게임 재시작"
            >
                🔄 Restart Game
            </button>
        </div>

        <div class="game-id">Game ID: ${safeGameId}</div>
    </div>

    <script>
        (function() {
            const btn = document.getElementById('restart-btn');
            if (!btn) return;
            
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const gameId = btn.dataset.gameid;
                
                window.parent.postMessage({
                    type: 'tool',
                    payload: {
                        toolName: 'selectRestart',
                        params: { gameId }
                    }
                }, '*');
                
                btn.disabled = true;
                btn.textContent = '🔄 Restarting...';
                btn.style.opacity = '0.6';
                btn.setAttribute('aria-busy', 'true');
            });
            
            // 접근성: 포커스 자동 설정
            btn.focus();
        })();
    </script>
</body>
</html>`;
  }

  /**
   * Delta 섹션 HTML 생성
   */
  private generateDeltaSection(deltas: DeltaInfo[]): string {
    if (deltas.length === 0) {
      return '';
    }

    const deltaItems = deltas
      .map(
        delta => `
      <div class="delta-item">
        ⚡ ${this.escapeHtml(delta.description)}
      </div>
    `
      )
      .join('');

    return `
      <div class="delta-section">
        <h3>📊 최근 변경사항</h3>
        ${deltaItems}
      </div>
    `;
  }

  private async handleSelectAction(params: SelectActionParams): Promise<CallToolResult> {
    if (!params.gameId || !params.selectedOption || params.selectedIndex === undefined) {
      throw new Error('gameId, selectedOption, and selectedIndex parameters are required');
    }
    const result = this.gameManager.selectAction(
      params.gameId,
      params.selectedOption,
      params.selectedIndex
    );

    const history = result.game.state._gameHistory || [];
    const recentChoices = history
      .slice(-3)
      .map((h: GameHistoryEntry) => h.selectedOption)
      .join(' → ');

    const responseText = this.formatToolResponse(
      'selectAction',
      'success',
      `Player selected: "${params.selectedOption}"`,
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Situation: "${result.game.state.lastStoryProgress}"`,
          `Selected: [${params.selectedIndex}] "${params.selectedOption}"`,
          `History: ${history.length}/10 entries`,
        ],
      },
      `Player's choice recorded. Selection: "${params.selectedOption}" in response to situation: "${result.game.state.lastStoryProgress}"`,
      {
        tool: 'updateGame',
        reason: `Apply the consequences of the selected action: "${params.selectedOption}"`,
        params: {
          gameId: params.gameId,
          fieldSelector:
            'Determine which game state field to modify (e.g., characters[0].hp, world.location, inventory)',
          value: 'Calculate new value based on the action outcome and current game state',
        },
      },
      'Step 4/5: createGame → progressStory → promptUserActions → [selectAction] → updateGame → progressStory',
      [
        'Determine consequences based on the selected action and current game state',
        'You may need to call updateGame multiple times for complex outcomes',
        'After all updates, call progressStory to narrate the results',
        `Recent player choices: ${recentChoices || 'This is the first choice'}`,
      ]
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  private async handleSelectRestart(params: SelectRestartParams): Promise<CallToolResult> {
    if (!params.gameId) {
      throw new Error('gameId parameter is required');
    }

    const result = this.gameManager.getGame(params.gameId);

    // 최종 상태 요약
    const finalState = {
      title: result.game.state.title,
      endedAt: result.game.updatedAt,
      characters: result.game.state.characters,
      world: result.game.state.world,
      finalProgress: result.game.state.lastStoryProgress,
      historyCount: result.game.state.gameHistory?.length || 0,
    };

    const responseText = this.formatToolResponse(
      'selectRestart',
      'success',
      'Player requested game restart',
      {
        gameId: params.gameId,
        title: result.game.state.title,
        keyState: [
          `Game ended at: ${result.game.updatedAt.toISOString()}`,
          `Total decisions made: ${finalState.historyCount}`,
          'Ready to start fresh',
        ],
      },
      `Game "${result.game.state.title}" has ended. Player wants to start a new adventure.`,
      {
        tool: 'createGame',
        reason: 'Create a fresh game with new initial state for the player',
        params: {
          initialStateInJson: {
            title: 'Suggest a new adventure based on the previous game experience',
            characters: 'Create new characters (can reference previous if helpful)',
            world: 'Design a new world and starting situation',
          },
        },
      },
      'Restart Flow: Game Over → [selectRestart] → createGame → progressStory',
      [
        'Previous game summary provided for context',
        'Player is ready for a new adventure',
        'Consider lessons learned from previous game when creating new one',
        `Previous game had ${finalState.historyCount} story decisions`,
      ]
    );

    return {
      content: [{ type: 'text', text: responseText }],
    };
  }

  /**
   * 서버 시작
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RPG MCP Server started successfully'); // stderr로 출력 (MCP 프로토콜과 겹치지 않음)
  }
}

// 서버 실행
const server = new RPGMCPServer();
server.run().catch((error: Error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
