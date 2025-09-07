#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GameManager } from './gameManager.js';
import {
  CreateGameParams,
  UpdateGameParams,
  GetGameParams,
  ProgressStoryParams,
  PromptUserActionsParams,
  SelectActionParams,
  ErrorResponse,
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
              'Create a new RPG game with complete initial state. Returns the created game with assigned gameId.',
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
              'Update a specific field in the game state and return the complete updated game state. Supports nested property updates using path notation.',
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
            description: 'Retrieve the complete current state of a game by its ID.',
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
              'Progress the game story. Advances the narrative and sets the current story progress. This should be called after createGame or updateGame to continue the story flow.',
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
            description:
              'Prompt the user with available action options. This completes the story progression cycle and waits for user input before the next updateGame call.',
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
                  description:
                    'List of available user action options. Must contain at least one option.',
                  minItems: 1,
                },
              },
              required: ['gameId', 'options'],
            },
          },
          {
            name: "selectAction",
            description: "Process user's selected action from UI and continue game flow",
            inputSchema: {
              type: "object",
              properties: {
                gameId: { type: "string", description: "ID of the game" },
                selectedOption: { type: "string", description: "The option text user selected" },
                selectedIndex: { type: "number", description: "Index of selected option (0-based)" }
              },
              required: ["gameId", "selectedOption", "selectedIndex"]
            }
          }
        ],
      };
    });
  }

  private async handleCreateGame(params: CreateGameParams): Promise<CallToolResult> {
    if (!params.initialStateInJson) {
      throw new Error('initialStateInJson parameter is required');
    }
    const result = this.gameManager.createGame(params.initialStateInJson);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleUpdateGame(params: UpdateGameParams): Promise<CallToolResult> {
    if (!params.gameId || !params.fieldSelector || params.value === undefined) {
      throw new Error('gameId, fieldSelector, and value parameters are required');
    }
    const result = this.gameManager.updateGame(params.gameId, params.fieldSelector, params.value);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetGame(params: GetGameParams): Promise<CallToolResult> {
    if (!params.gameId) {
      throw new Error('gameId parameter is required');
    }
    const result = this.gameManager.getGame(params.gameId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleProgressStory(params: ProgressStoryParams): Promise<CallToolResult> {
    if (!params.gameId || typeof params.progress !== 'string') {
      throw new Error('gameId and progress parameters are required');
    }
    const result = this.gameManager.progressStory(params.gameId, params.progress);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
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

    const uiResource = {
      type: 'resource' as const,
      resource: {
        uri: `ui://rpg-game/${params.gameId}/actions`,
        mimeType: 'text/html',
        text: uiHtml,
        _meta: {
          title: 'RPG Game Actions',
          description: `게임 ${params.gameId}의 액션 선택`,
          preferredRenderContext: 'main',
        }
      }
    };

    return {
      content: [
        uiResource,
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * 게임 UI HTML 생성
   */
  private generateGameUI(storyProgress: string, options: string[], gameId: string): string {
    const optionButtons = options.map((option, index) => `
      <button 
        class="action-button" 
        onclick="selectAction('${gameId}', '${option.replace(/'/g, "\\'")}', ${index})"
      >
        ${option}
      </button>
    `).join('');

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

  private async handleSelectAction(params: SelectActionParams): Promise<CallToolResult> {
    if (!params.gameId || !params.selectedOption || params.selectedIndex === undefined) {
      throw new Error('gameId, selectedOption, and selectedIndex parameters are required');
    }
    const result = this.gameManager.selectAction(params.gameId, params.selectedOption, params.selectedIndex);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
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
