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
  ErrorResponse,
  DeltaInfo,
  GameHistoryEntry,
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
              'Update a specific field in the game state and return the complete updated game state. Supports nested property updates using path notation. Use progressStory next to advance the narrative.',
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

    const optionButtons = options
      .map(
        (option, index) => `
      <button 
        class="action-button" 
        onclick="selectAction('${gameId}', '${option.replace(/'/g, "\\'")}', ${index})"
      >
        ${option}
      </button>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RPG Game - ${gameId}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
        }
        .game-container {
            background: white;
            border-radius: 15px;
            padding: 30px;
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
        }
    </style>
</head>
<body>
    <div class="game-container">
        <div class="story-section">
            ${storyProgress}
        </div>
        
        ${deltaSection}
        
        <div class="actions-section">
            <h3>🎯 선택하세요:</h3>
            ${optionButtons}
        </div>
        
        <div class="game-id">Game ID: ${gameId}</div>
    </div>

    <script>
        function selectAction(gameId, selectedOption, selectedIndex) {
            // MCP 도구 호출을 시뮬레이션
            const result = {
                tool: 'selectAction',
                params: {
                    gameId: gameId,
                    selectedOption: selectedOption,
                    selectedIndex: selectedIndex
                },
                timestamp: new Date().toISOString()
            };
            
            // 선택된 버튼 하이라이트
            const buttons = document.querySelectorAll('.action-button');
            buttons.forEach(btn => btn.style.opacity = '0.5');
            buttons[selectedIndex].style.opacity = '1';
            buttons[selectedIndex].style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            
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
        }
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
        ⚡ ${delta.description}
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
