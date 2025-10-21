# RPG MCP Server

An immersive Role-Playing Game server built on the Model Context Protocol (MCP), designed to work with AI assistants like Claude to create interactive storytelling experiences.

## Features

### 🎮 Game Tools

The server provides 7 core tools for building and managing RPG games:

1. **`createGame`** - Initialize a new RPG game
   - Set up initial game state (characters, world, inventory, etc.)
   - Auto-generates unique game ID

2. **`updateGame`** - Update game state
   - Supports nested field paths (e.g., `characters[0].level`, `world.location`)
   - Real-time change tracking with Delta system
   - **Game Over Support:** If a state update results in game over (e.g., HP reaches 0, bad ending), set `isGameOver=true` and provide a `gameOverReason`. The server will return a special Game Over UI with an empathetic explanation and suggestions for improvement.

3. **`getGame`** - Retrieve current game state
   - Access complete game state at any time

4. **`progressStory`** - Advance the narrative
   - Record current situation and events
   - Manage narrative flow

5. **`promptUserActions`** - Present action choices to users
   - **Dynamic Choices:** Always present 2-4 options that mix positive and negative outcomes for dynamic, engaging gameplay. Each option should have distinct consequences and risk/reward tradeoffs.
   - Generate interactive UI
   - Web-based action selection interface

6. **`selectAction`** - Process user selections
   - Apply chosen actions to game state
   - Automatically record game history

7. **`selectRestart`** - Restart the game after game over
   - Called when player clicks Restart button on Game Over screen
   - Provides game summary and context for creating a new game
   - AI agent receives guidance to create a contextually relevant new adventure

### 🎯 User Interaction

#### Basic Game Flow

```text
createGame → progressStory → promptUserActions → selectAction → updateGame → progressStory → ...
```

#### Game Over & Restart Flow

When a game ends (e.g., character HP reaches 0 or story reaches an ending):

```text
updateGame (isGameOver=true) → Game Over UI displayed →
User clicks Restart button → selectRestart →
AI creates new game with context → progressStory → ...
```

The restart flow includes:

- **Context Preservation**: Previous game summary is provided to the AI
- **AI-Suggested Continuation**: AI can create thematically related or evolved adventures
- **One-Click Restart**: No manual intervention needed from the player
- **Empathetic Messaging**: Game Over screen explains what happened and suggests improvements

#### Interactive UI

- **Web-based Selection Interface**: Beautiful UI automatically generated with story progression
- **Real-time Change Display**: Visual feedback for recent changes via Delta system
- **Game Over Screen**: When the game ends, a special UI explains why, what could have been done differently, and includes a Restart button
- **Game History**: Automatically saves last 10 situation-choice records
- **Restart Button**: Interactive button on Game Over screen that triggers `selectRestart` tool

#### Example Game Scenario

```typescript
// 1. Create Game
{
  "title": "Wizard's Adventure",
  "characters": [
    {"name": "Elara", "level": 1, "hp": 100, "mp": 50, "class": "Wizard"}
  ],
  "world": {"location": "Magic Academy", "time": "morning", "weather": "sunny"},
  "inventory": [{"name": "Magic Staff", "type": "weapon"}]
}

// 2. Progress Story
"Elara discovers an ancient spellbook in the academy library..."

// 3. Present Choices (always mix positive/negative outcomes)
[
  "Read the spellbook (may gain power, but risk a curse)",
  "Tell the professor (safe, but lose a chance for secret knowledge)",
  "Leave it where it is (avoid risk, but miss opportunity)",
  "Try to sell it secretly (potential reward, but risk being caught)"
]

// 4. Update game state after user selection
"characters[0].hp": 0, // triggers game over
"isGameOver": true,
"gameOverReason": "Elara triggered a powerful curse from the spellbook and lost all HP. If you had chosen to consult the professor or left the book alone, you might have avoided this fate."
```

## MCP Client Requirements

### Essential Requirements

- **MCP Protocol Support**: MCP SDK 0.5.0 or higher
- **MCP-UI Integration**: HTML resource rendering support
- **Tool Execution**: Ability to execute all 6 game tools

### Recommended Clients

- **Claude Desktop** (officially supported)
- **MCP-UI compatible clients**
- Alternative: [synaptic-flow](https://github.com/idosal/mcp-ui) and other MCP-UI compatible clients

## Claude Desktop Setup

### Step 1: Locate Configuration File

Platform-specific config file locations:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`  
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Step 2: Edit Configuration File

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Step 3: Restart Claude Desktop

Completely quit and restart Claude Desktop to apply the configuration.

### Step 4: Test the Setup

```text
Hi! Can you create a fantasy RPG game for me?
```

## Installation & Usage

### Global Installation (Recommended)

```bash
npm install -g rpg-mcp-server
```

### Local Development

```bash
git clone <repository-url>
cd rpg-mcp-server
npm install
npm run build
npm start
```

### Testing with MCP Inspector

```bash
npm run inspector
```

## Technology Stack

- **TypeScript** - Type safety and developer experience
- **MCP SDK** - Model Context Protocol implementation
- **MCP-UI** - Interactive web UI generation
- **Node.js** - Runtime environment

## System Requirements

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **MCP-compatible client**

## License

MIT License - see [LICENSE](LICENSE) file for details.
