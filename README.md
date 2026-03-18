# MCP.STORE — AgentGateway Hackathon Project

## 📖 Project Summary

MCP.STORE is an e-commerce platform with role-based access control, developed using **AgentGateway** and **Gemini AI**. Its main goal is to secure and track who accesses the MCP (Model Context Protocol) servers, when, and with what permissions using **Keycloak JWT authentication**, **AgentGateway authorization**, and **Jaeger tracing**.

---

## 🎥 Demo

[![MCP.STORE Demo](https://img.youtube.com/vi/OFJhmMtqc6k/maxresdefault.jpg)](https://youtu.be/OFJhmMtqc6k)


## 📖 Blog Post

Full technical write-up → [Medium](https://medium.com/@mehmethilmi81/securing-ai-agents-at-scale-role-based-access-control-for-mcp-with-agentgateway-ac046366da7c)


## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend   │────▶│  Agent API  │────▶│  AgentGateway    │────▶│  MCP Server │
│  (React)    │     │ (FastAPI    │     │  (Port 3000)     │     │  (FastMCP   │
│  Port 5173  │     │  Port 8001) │     │                  │     │  Port 9000) │
└─────────────┘     └─────────────┘     └──────────────────┘     └─────────────┘
       │                   │                     │                       │
       │                   │              ┌───────────────┐              │
       ▼                   │              │   Keycloak    │              ▼
┌─────────────┐            │              │  JWT Auth     │      ┌─────────────┐
│  Core DB    │◀───────────┘              │  Port 8080    │      │   SQLite    │
│  (FastAPI   │                           └───────────────┘      │   database  │
│  Port 8000) │                                  │               └─────────────┘
└─────────────┘                           ┌───────────────┐
                                          │    Jaeger     │
                                          │  Tracing UI   │
                                          │  Port 16686   │
                                          └───────────────┘
```

### Request Flow

1. User types a message from the frontend
2. Frontend sends a POST request with Bearer token to Agent API (`/chat`)
3. Agent API forwards the message and tool definitions to Gemini
4. Gemini makes a tool call
5. Agent API → Sends MCP JSON-RPC request to AgentGateway
6. AgentGateway verifies the JWT (Keycloak JWKS) and performs authorization checks using CEL rules
7. If authorized → Forwards to MCP Server → Fetches data from DB → Returns result
8. If unauthorized → Returns 403
9. All operations are recorded as traces in Jaeger

---

## 📁 Project Structure

```
agentgateway_hackathon/
├── frontend/                    # React + Vite + Tailwind
│   └── src/
│       ├── pages/
│       │   ├── BuyerDashboard.jsx   # Buyer page
│       │   ├── SellerDashboard.jsx  # Seller page
│       │   └── Dashboard.jsx        # Admin observability
│       ├── components/
│       │   ├── Login.jsx
│       │   └── Register.jsx
│       ├── utils/
│       │   └── auth.js              # Token refresh management
│       └── App.jsx                  # Role-based routing
│
├── agent_api/
│   ├── chat_server.py           # Gemini ↔ MCP bridge (Port 8001)
│   └── .env
│
├── core_api/
│   └── db_server.py             # SQLite REST API (Port 8000)
│
├── mcp_server/
│   └── tools.py                 # FastMCP tool definitions (Port 9000)
│
├── gateway/
│   └── config.yaml              # AgentGateway configuration
│
└── docker-compose.yml           # Keycloak + Jaeger
```

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- AgentGateway binary (`agentgateway`)
- Gemini API Key

### 1. Start Docker Services (Keycloak + Jaeger)

```bash
docker compose up -d
```

Keycloak: http://localhost:8080 (admin/admin)
Jaeger UI: http://localhost:16686

### 2. Keycloak Configuration

Tasks to be performed from the Keycloak admin panel (`http://localhost:8080`):

**Create Realm:**
- Realm name: `mcp_demo`

**Create Client:**
- Client ID: `mcp_client`
- Client type: `OpenID Connect`
- Direct access grants: ✅ Enabled
- Valid redirect URIs: `http://localhost:5173/*`

**Create Roles** (Realm roles):
- `buyer`
- `seller`
- `admin`

**Assign `admin` role to the admin user:**
- Users → select user → Role Mappings → add `admin`

### 3. Python Environment

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn httpx python-dotenv google-genai fastmcp pydantic
```

### 4. Environment Variables

Create the `agent_api/.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GATEWAY_URL=http://127.0.0.1:3000/mcp
PORT=8001
```

### 5. Start Services (Each in a separate terminal)

**Terminal 1 — Core DB API:**
```bash
cd core_api
python db_server.py
# Runs on Port 8000
```

**Terminal 2 — MCP Server:**
```bash
cd mcp_server
python tools.py
# Runs on Port 9000
```

**Terminal 3 — AgentGateway:**
```bash
cd gateway
agentgateway -f config.yaml
# Runs on Port 3000
```

**Terminal 4 — Agent API:**
```bash
cd agent_api
python chat_server.py
# Runs on Port 8001
```

**Terminal 5 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on Port 5173
```

---

## 👥 User Roles

| Role | Access | Routing |
|-----|--------|-------------|
| `buyer` | List products, cart management, order | `/buyer` |
| `seller` | Add/delete/update products, profit report | `/seller` |
| `admin` | All operations + Observability dashboard | `/admin` |

After logging in, automatic routing is performed based on the `realm_access.roles` value within the token.

---

## 🔧 MCP Tools

### Common Tools (buyer + seller + admin)
| Tool | Description |
|------|----------|
| `list_products` | Lists all products |
| `get_product_detail` | Retrieves product detail |

### Seller Tools
| Tool | Description |
|------|----------|
| `add_product` | Adds a new product |
| `get_my_products` | Seller's own products |
| `update_product_stock` | Updates stock |
| `delete_product` | Deletes a product |
| `get_store_profit_loss` | Profit/loss report |

### Buyer Tools
| Tool | Description |
|------|----------|
| `add_to_cart` | Adds to cart |
| `get_cart` | Shows the cart |
| `remove_from_cart` | Removes from cart |
| `checkout` | Completes the order |
| `get_my_orders` | Past orders |

---

## 🛡️ AgentGateway Configuration

The `gateway/config.yaml` file provides three-layered security:

### 1. CORS
Allows all origins, enables necessary headers.

### 2. MCP Authentication (Keycloak JWT)
```yaml
mcpAuthentication:
  issuer: http://localhost:8080/realms/mcp_demo
  jwksUrl: http://localhost:8080/realms/mcp_demo/protocol/openid-connect/certs
  audience: account
  provider:
    keycloak: {}
```

### 3. MCP Authorization (CEL Rules)
```yaml
mcpAuthorization:
  rules:
  - mcp.tool.name in ["list_products", "get_product_detail", "add_to_cart", ...] && "buyer" in jwt.realm_access.roles
  - mcp.tool.name in ["add_product", "get_my_products", ...] && "seller" in jwt.realm_access.roles
  - mcp.tool.name in [...] && "admin" in jwt.realm_access.roles
```

### 4. Tracing (Jaeger OTLP)
```yaml
config:
  tracing:
    otlpEndpoint: http://localhost:4317
    randomSampling: true
    fields:
      add:
        username: 'jwt.preferred_username'
        role: 'jwt.realm_access.roles'
        tool_name: 'mcp.resource.name'
        mcp_method: 'mcp.method'
```

JWT claims are automatically added to every trace — Jaeger shows who called which tool and when.

---

## 📊 Admin Observability Dashboard

The `/admin` route contains 4 tabs:

- **📊 Summary** — Total traces, tool calls, error counts, average latency
- **🔍 Traces** — Jaeger trace list, username/role/tool detail in each trace
- **📈 Metrics** — Gateway Prometheus metrics + Jaeger source statistics
- **📋 Logs** — Log lines generated from traces, live stream with Live mode

The dashboard connects to the Jaeger API (`http://localhost:16686/api/traces`) via CORS proxy:
```
Frontend → db_server.py/proxy/jaeger/traces → Jaeger API
```

---

## 🔄 Token Management

Keycloak tokens are valid for 5 minutes. The `src/utils/auth.js` file:

1. Checks the token expiration time before every API request
2. Refreshes it automatically with `refresh_token` if less than 30 seconds remain
3. Logs the user out if the refresh fails

---

## 🗄️ Database Tables

SQLite (`database.db`):

| Table | Description |
|-------|----------|
| `products` | Products (product_code, name, price, stock, seller_username) |
| `store_stats` | Store statistics (period, revenue, cost) |
| `cart` | Cart (username, product_code, quantity) |
| `orders` | Orders (username, product_code, quantity, total_price) |

---

## 🧪 Test Scenarios

### With Buyer:
```
"list products"                       → calls list_products
"add MSI laptop to my cart"           → calls add_to_cart
"show my cart"                        → calls get_cart
"checkout"                            → calls checkout
"show this month's profit report"     → 403 AUTHORIZATION ERROR (seller tool)
```

### With Seller:
```
"list my products"                    → calls get_my_products
"show this month's profit status"     → calls get_store_profit_loss
"add product with code TEST-001..."   → calls add_product
"show my cart"                        → 403 AUTHORIZATION ERROR (buyer tool)
```

### With Admin:
```
Access to all tools + /admin dashboard
```

---

## 🐛 Common Issues

### "JWT token required" error
- Token might have expired → Log out, log back in
- Authorization header is missing → Check token in frontend

### "Not Acceptable" error (Gateway)
- `Accept: application/json, text/event-stream` header is missing

### 502 Bad Gateway (Agent API)
- Check the `GATEWAY_URL` env variable: it should be `http://127.0.0.1:3000/mcp`
- Is AgentGateway running? `agentgateway -f config.yaml`

### Keycloak "Invalid user credentials"
- Password was not set during registration → `credentials` field must be in the register payload

### No traces in Jaeger
- Is the `otlpEndpoint` value of AgentGateway correct?
- Verify Jaeger container is running with `docker ps | grep jaeger`

---

## 📦 Technologies Used

| Technology | Version | Usage |
|-----------|----------|----------|
| AgentGateway | latest | MCP proxy, auth, tracing |
| FastMCP | latest | MCP server |
| Gemini | 2.0 Flash | AI assistant |
| Keycloak | 26.0 | Identity provider |
| Jaeger | latest | Distributed tracing |
| FastAPI | latest | REST API |
| React | 19 | Frontend |
| Tailwind CSS | 4 | Styling |
| SQLite | 3 | Database |



## 📖 Ekstra Resources
- Medium : https://medium.com/@mehmethilmi81/building-a-multi-agent-ai-system-with-google-adk-mcp-and-agentgateway-52eaf2a84c1a
- Youtube : https://www.youtube.com/watch?v=Zv7sBQ9dZzU
