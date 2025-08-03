# RPG MCP Server (TypeScript)

LLM이 Tool을 통해 롤플레잉 게임을 생성하고 관리할 수 있는 MCP 서버입니다. TypeScript로 작성되어 타입 안정성과 개발 경험을 향상시켰습니다.

## 설치 및 실행

```bash
# 의존성 설치
npm install

# TypeScript 빌드
npm run build

# 서버 실행
npm start

# 개발 모드 (빌드 + 실행)
npm run dev
```

## 개발 스크립트

```bash
npm run build      # TypeScript 컴파일
npm run dev        # 빌드 후 실행
npm run clean      # 빌드 폴더 삭제
npm run type-check # 타입 체크만 실행
```

## Claude Desktop 연동 (추천)

Claude Desktop에서 이 MCP 서버를 사용하는 가장 쉬운 방법:

### 1. NPX를 사용한 설정 (패키지 설치 불필요)

Claude Desktop 설정 파일을 수정하세요:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

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

### 2. 로컬 개발 버전 사용

이 프로젝트를 클론하고 로컬에서 개발하는 경우:

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/your/rpg-mcp-server",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### 3. Claude Desktop 재시작

설정 파일을 수정한 후 Claude Desktop을 완전히 종료하고 다시 시작하세요.

## 기타 MCP 클라이언트 연동

MCP 클라이언트에서 이 서버를 사용하려면, 클라이언트의 설정 파일(예: `~/.mcp/config.yaml`)에 다음 서버 설정을 추가하세요.

```yaml
# ~/.mcp/config.yaml 예시

servers:
  - name: rpg-server
    command: ["npm", "start"]
    workingDirectory: "/Users/1111108/my_work/role-playing-mcp-server" # 실제 프로젝트 경로로 수정하세요
```

- `name`: 클라이언트에서 사용할 서버의 별칭입니다.
- `command`: `npm start` 명령어를 사용하여 서버를 실행합니다.
- `workingDirectory`: 이 프로젝트의 절대 경로를 지정해야 합니다. 위 예시의 경로는 실제 환경에 맞게 수정해주세요.

## Tools

### createGame
게임을 생성합니다. LLM이 초기 상태를 JSON으로 완전히 자유롭게 구성할 수 있습니다.

### updateGame  
게임 상태를 업데이트합니다. 경로 기반으로 중첩된 값도 수정 가능합니다.

### getGame
전체 게임 상태를 조회합니다.

## 사용 예시

### 로맨스 게임 생성
```json
{
  "title": "고등학교 첫사랑",
  "characters": [
    {"id": "player", "name": "주인공", "매력": 50},
    {"id": "sakura", "name": "사쿠라", "호감도": 20}
  ]
}
```

### 상태 업데이트
```
fieldSelector: "characters[1].호감도"
value: 35
```