# RPG MCP Server

An immersive Role-Playing Game server built on the Model Context Protocol (MCP), designed to work with AI assistants like Claude to create interactive storytelling experiences.

## Features

### 🎮 Game Tools

The server provides 6 core tools for building and managing RPG games:

1. **`createGame`** - Initialize a new RPG game
   - Set up initial game state (characters, world, inventory, etc.)
   - Auto-generates unique game ID

2. **`updateGame`** - Update game state
   - Supports nested field paths (e.g., `characters[0].level`, `world.location`)
   - Real-time change tracking with Delta system

3. **`getGame`** - Retrieve current game state
   - Access complete game state at any time

4. **`progressStory`** - Advance the narrative
   - Record current situation and events
   - Manage narrative flow

5. **`promptUserActions`** - Present action choices to users
   - Generate interactive UI
   - Web-based action selection interface

6. **`selectAction`** - Process user selections
   - Apply chosen actions to game state
   - Automatically record game history

### 🎯 User Interaction

#### Basic Game Flow

```text
createGame → progressStory → promptUserActions → selectAction → updateGame → progressStory → ...
```

#### Interactive UI

- **Web-based Selection Interface**: Beautiful UI automatically generated with story progression
- **Real-time Change Display**: Visual feedback for recent changes via Delta system
- **Game History**: Automatically saves last 10 situation-choice records

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

// 3. Present Choices
["Read the spellbook", "Tell the professor", "Leave it where it is"]

// 4. Update game state after user selection
"characters[0].favorability": +5
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

