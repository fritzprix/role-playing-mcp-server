#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GameManager } from './gameManager.js';
import { CreateGameParams, UpdateGameParams, GetGameParams, ProgressStoryParams, PromptUserActionsParams, ErrorResponse } from './types.js';

/**
 * RPG 게임 MCP 서버
 * 5개의 Tool 제공: createGame, updateGame, getGame, progressStory, promptUserActions
 */
class RPGMCPServer {
  private server: Server;
  private gameManager: GameManager;

  constructor() {
    this.server = new Server({
      name: "rpg-mcp-server",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.gameManager = new GameManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool 호출 처리
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments || {};
      
      console.error(`Tool called: ${toolName}`, toolArgs); // 디버깅용 로그
      
      try {
        let result: any;
        
        switch(toolName) {
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
            result = await this.handlePromptUserActions(toolArgs as unknown as PromptUserActionsParams);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        console.error(`Tool ${toolName} executed successfully`); // 성공 로그
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };

      } catch (error: any) {
        console.error('Tool execution error:', {
          name: toolName,
          args: toolArgs,
          error: error.message,
          stack: error.stack
        });
        
        const errorResponse: ErrorResponse = {
          error: error.message,
          tool: toolName,
          timestamp: new Date().toISOString()
        };
        
        return {
          content: [{
            type: "text", 
            text: JSON.stringify(errorResponse, null, 2)
          }],
          isError: true
        };
      }
    });

    // 사용 가능한 Tool 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "createGame",
            description: "Create a new RPG game with complete initial state. Returns the created game with assigned gameId.",
            inputSchema: {
              type: "object",
              properties: {
                initialStateInJson: {
                  type: "object",
                  description: "Complete game state object. Must include title, characters array, and game world settings. Example: {\"title\": \"Fantasy Adventure\", \"characters\": [{\"name\": \"Hero\", \"level\": 1, \"hp\": 100}], \"world\": {\"location\": \"Village\", \"time\": \"morning\"}}",
                  examples: [
                    {
                      "title": "Fantasy Adventure",
                      "characters": [
                        {"name": "Hero", "level": 1, "hp": 100, "mp": 50, "class": "Warrior"}
                      ],
                      "world": {"location": "Starting Village", "time": "morning", "weather": "sunny"},
                      "inventory": [],
                      "story": {"chapter": 1, "progress": "beginning"}
                    }
                  ]
                }
              },
              required: ["initialStateInJson"]
            }
          },
          {
            name: "updateGame",
            description: "Update a specific field in the game state and return the complete updated game state. Supports nested property updates using path notation.",
            inputSchema: {
              type: "object",
              properties: {
                gameId: {
                  type: "string",
                  description: "ID of the game to update"
                },
                fieldSelector: {
                  type: "string", 
                  description: "Path to the field to update. Examples: 'characters[0].level', 'world.time', 'player.stats.hp', 'characters[1].favorability'"
                },
                value: {
                  type: ["string", "number", "object", "array", "boolean", "null"],
                  description: "New value to set (supports all types: string, number, object, array, boolean, null)",
                  examples: [
                    5,
                    "new location",
                    {"hp": 100, "mp": 50},
                    ["item1", "item2"],
                    true,
                    null
                  ]
                }
              },
              required: ["gameId", "fieldSelector", "value"]
            }
          },
          {
            name: "getGame", 
            description: "Retrieve the complete current state of a game by its ID.",
            inputSchema: {
              type: "object",
              properties: {
                gameId: {
                  type: "string",
                  description: "ID of the game to retrieve"
                }
              },
              required: ["gameId"]
            }
          },
          {
            name: "progressStory",
            description: "Progress the game story. Advances the narrative and sets the current story progress. This should be called after createGame or updateGame to continue the story flow.",
            inputSchema: {
              type: "object",
              properties: {
                gameId: {
                  type: "string",
                  description: "ID of the game to progress"
                },
                progress: {
                  type: "string",
                  description: "Description of the current story progress or event. Should describe what happens next in the narrative."
                }
              },
              required: ["gameId", "progress"]
            }
          },
          {
            name: "promptUserActions",
            description: "Prompt the user with available action options. This completes the story progression cycle and waits for user input before the next updateGame call.",
            inputSchema: {
              type: "object",
              properties: {
                gameId: {
                  type: "string",
                  description: "ID of the game to prompt"
                },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of available user action options. Must contain at least one option.",
                  minItems: 1
                }
              },
              required: ["gameId", "options"]
            }
          }
        ]
      };
    });
  }

  private async handleCreateGame(params: CreateGameParams): Promise<any> {
    if (!params.initialStateInJson) {
      throw new Error('initialStateInJson parameter is required');
    }
    return this.gameManager.createGame(params.initialStateInJson);
  }

  private async handleUpdateGame(params: UpdateGameParams): Promise<any> {
    if (!params.gameId || !params.fieldSelector || params.value === undefined) {
      throw new Error('gameId, fieldSelector, and value parameters are required');
    }
    return this.gameManager.updateGame(params.gameId, params.fieldSelector, params.value);
  }

  private async handleGetGame(params: GetGameParams): Promise<any> {
    if (!params.gameId) {
      throw new Error('gameId parameter is required');
    }
    return this.gameManager.getGame(params.gameId);
  }


  private async handleProgressStory(params: ProgressStoryParams): Promise<any> {
    if (!params.gameId || typeof params.progress !== 'string') {
      throw new Error('gameId and progress parameters are required');
    }
    return this.gameManager.progressStory(params.gameId, params.progress);
  }

  private async handlePromptUserActions(params: PromptUserActionsParams): Promise<any> {
    if (!params.gameId || !Array.isArray(params.options)) {
      throw new Error('gameId and options parameters are required');
    }
    if (params.options.length === 0) {
      throw new Error('options array cannot be empty');
    }
    return this.gameManager.promptUserActions(params.gameId, params.options);
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
