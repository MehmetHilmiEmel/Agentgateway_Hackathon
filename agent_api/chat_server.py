import os
import base64
import json
import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GATEWAY_URL    = os.getenv("GATEWAY_URL", "http://127.0.0.1:3000/mcp")

client = genai.Client(api_key=GEMINI_API_KEY)
app    = FastAPI(title="Gemini MCP Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

def decode_username(authorization: str) -> str:
    try:
        token   = authorization.replace("Bearer ", "")
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.b64decode(payload))
        
        exp = decoded.get('exp', 0)
        import time
        remaining = int(exp - time.time())
        print(f"✅ Token valid, {remaining} seconds left")

        return decoded.get('preferred_username', 'user')
    except:
        return 'user'

def mcp_schema_to_gemini(tool: dict, username: str) -> dict:
    """Converts the FastMCP inputSchema format to the Gemini function declaration format."""
    gemini_tool = {
        "name": tool["name"],
        "description": tool.get("description", ""),
    }
    input_schema = tool.get("inputSchema", {})
    properties   = input_schema.get("properties", {})
    required     = input_schema.get("required", [])

    if properties:
        gemini_props = {}
        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get("type", "string").upper()
            
            # JSON Schema -> Gemini type mapping
            type_map = {
                "STRING":  "STRING",
                "NUMBER":  "NUMBER",
                "INTEGER": "INTEGER",
                "BOOLEAN": "BOOLEAN",
                "ARRAY":   "ARRAY",
                "OBJECT":  "OBJECT",
            }
            gemini_type = type_map.get(prop_type, "STRING")
            
            # Add an automatic hint to username/seller_username parameters
            description = prop_def.get("description", "")
            if prop_name in ("username", "seller_username"):
                description = f"Always use '{username}' for this parameter."

            gemini_props[prop_name] = {
                "type":        gemini_type,
                "description": description,
            }

        gemini_tool["parameters"] = {
            "type":       "OBJECT",
            "properties": gemini_props,
            "required":   required,
        }
    return gemini_tool

async def fetch_mcp_tools(auth_token: str, username: str) -> tuple[list, str]:
    """Initialize session then fetch tools from gateway."""
    headers = {
        "Authorization": auth_token,
        "Content-Type":  "application/json",
        "Accept":        "application/json, text/event-stream",
        "mcp-protocol-version": "2024-11-05",
    }
    
    async with httpx.AsyncClient() as http_client:
        try:
            init_payload = {
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "agent-api", "version": "1.0"}
                }
            }
            init_res = await http_client.post(GATEWAY_URL, json=init_payload, headers=headers, timeout=10.0)
            session_id = init_res.headers.get("mcp-session-id")
            
            if not session_id:
                print(f"❌ No session ID received: {init_res.status_code} {init_res.text[:200]}")
                return [], None

            print(f"✅ Session established: {session_id[:30]}...")
            headers["mcp-session-id"] = session_id

            # 2. Tools/list
            tools_payload = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
            res = await http_client.post(GATEWAY_URL, json=tools_payload, headers=headers, timeout=10.0)
            raw = res.text
            if raw.startswith("data:"):
                raw = raw[len("data:"):].strip()
            
            result = json.loads(raw)
            tools  = result.get("result", {}).get("tools", [])
            print(f"📋 {len(tools)} tools fetched from gateway")
            
            return [mcp_schema_to_gemini(t, username) for t in tools], session_id

        except Exception as e:
            print(f"❌ Tool fetch error: {e}")
            return [], None

async def call_mcp_gateway(method_name: str, arguments: dict, auth_token: str, session_id: str) -> str:
    headers = {
        "Authorization": auth_token,
        "Content-Type":  "application/json",
        "Accept":        "application/json, text/event-stream",
        "mcp-protocol-version": "2024-11-05",
        "mcp-session-id": session_id, 
    }
    payload = {
        "jsonrpc": "2.0",
        "id":      1,
        "method":  "tools/call",
        "params":  {"name": method_name, "arguments": arguments}
    }

    print(f"🔑 Token first 50 chars: {auth_token[:50]}")
    print(f"🔧 Call: {method_name} {arguments}")

    async with httpx.AsyncClient() as http_client:
        try:
            res = await http_client.post(GATEWAY_URL, json=payload, headers=headers, timeout=20.0)

            if res.status_code in (403, 500):
                text = res.text.lower()
                if any(w in text for w in ["unauthorized", "forbidden", "authorization"]):
                    return "ERROR: You do not have permission for this action."
                return f"Server error: {res.status_code}"

            raw = res.text
            if raw.startswith("data:"):
                raw = raw[len("data:"):].strip()
            
            result = json.loads(raw)

            if "result" in result and "content" in result["result"]:
                return result["result"]["content"][0].get("text", "Empty result.")
            if "result" in result and "result" in result["result"]:
                return str(result["result"]["result"])

            return f"Error: {result.get('error', {}).get('message', 'Unknown error')}"
        except Exception as e:
            return f"Connection error: {str(e)}"

@app.post("/chat")
async def chat_with_agent(request: ChatRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token missing!")

    username = decode_username(authorization)
    tools_definition, session_id = await fetch_mcp_tools(authorization, username)
    if not tools_definition:
        raise HTTPException(status_code=500, detail="Could not fetch tools from gateway.")

    try:
        chat = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=f"""You are an e-commerce assistant.
                CURRENT USER: {username}
                CRITICAL RULES:
                1. Call tools DIRECTLY, never ask for confirmation or permission.
                2. Always use '{username}' for username and seller_username parameters.
                3. If you get an authorization error, just say 'You do not have permission for this action.'
                4. Use 'this_month' as the default period if not specified.
                5. All prices are in USD. Always show prices with the $ symbol.
                6. For add_to_cart, always use the exact product_code. If unknown, call list_products first.
                7. Always respond in English.
                8. Keep responses short and clear.""",
                tools=[{"function_declarations": tools_definition}]
            )
        )

        response = chat.send_message(request.message)

        for _ in range(5): # Loop for multi-turn function calling
            parts = response.candidates[0].content.parts
            fc    = next((p for p in parts if hasattr(p, 'function_call') and p.function_call), None)

            if not fc:
                break
            
            call        = fc.function_call
            tool_result = await call_mcp_gateway(call.name, dict(call.args), authorization, session_id)
            print(f"🔧 {call.name} → {tool_result[:80]}")

            response = chat.send_message(
                types.Part(
                    function_response=types.FunctionResponse(
                        name=call.name,
                        response={"result": tool_result}
                    )
                )
            )

        final_text = response.text
        if not final_text:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    final_text = part.text
                    break
        
        return {"message": final_text or "Done.", "status": "success"}

    except Exception as e:
        print(f"❌ {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
