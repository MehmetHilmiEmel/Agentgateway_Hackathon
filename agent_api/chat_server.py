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
        import time
        token   = authorization.replace("Bearer ", "")
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.b64decode(payload))
        
        # Token expiration check
        exp = decoded.get('exp', 0)
        if exp < time.time():
            print("⚠️ TOKEN EXPIRED!")
        else:
            print(f"✅ Token valid, {int(exp - time.time())} seconds left")
            
        return decoded.get('preferred_username', 'user')
    except:
        return 'user'

def get_tools_definition(username: str) -> list:
    return [
        {
            "name": "list_products",
            "description": "Lists all products in the store."
        },
        {
            "name": "get_product_detail",
            "description": "Fetches detailed info by product code.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "product_code": {"type": "STRING", "description": "Product code"}
                },
                "required": ["product_code"]
            }
        },
        {
            "name": "add_product",
            "description": "Adds a new product for sellers.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "product_code":    {"type": "STRING"},
                    "name":            {"type": "STRING"},
                    "price":           {"type": "NUMBER"},
                    "stock":           {"type": "INTEGER"},
                    "seller_username": {"type": "STRING", "description": f"Seller name, always use '{username}'"}
                },
                "required": ["product_code", "name", "price", "stock", "seller_username"]
            }
        },
        {
            "name": "get_my_products",
            "description": "Lists the seller's own products.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "seller_username": {"type": "STRING", "description": f"Always use '{username}'"}
                },
                "required": ["seller_username"]
            }
        },
        {
            "name": "update_product_stock",
            "description": "Updates product stock.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "product_code": {"type": "STRING"},
                    "new_stock":    {"type": "INTEGER"}
                },
                "required": ["product_code", "new_stock"]
            }
        },
        {
            "name": "delete_product",
            "description": "Deletes the product.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "product_code": {"type": "STRING"}
                },
                "required": ["product_code"]
            }
        },
        {
            "name": "get_store_profit_loss",
            "description": "Fetches financial report for sellers.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "period": {"type": "STRING", "description": "this_month or last_month"}
                }
            }
        },
        {
            "name": "add_to_cart",
            "description": "Adds a product to the cart. Use for requests like 'add to cart', 'i want to buy this', 'i want this'.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "username":     {"type": "STRING", "description": f"Always use '{username}'"},
                    "product_code": {"type": "STRING"},
                    "quantity":     {"type": "INTEGER", "description": "Quantity, default 1"}
                },
                "required": ["username", "product_code"]
            }
        },
{
    "name": "get_cart",
    "description": "Shows the user's shopping cart. Use for requests like 'show my cart', 'look at my cart', 'what is in my cart', 'list cart'.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "username": {"type": "STRING", "description": f"Always use '{username}'"}
        },
        "required": ["username"]
    }
},
        {
            "name": "remove_from_cart",
            "description": "Removes product from the cart.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "username":     {"type": "STRING", "description": f"Always use '{username}'"},
                    "product_code": {"type": "STRING"}
                },
                "required": ["username", "product_code"]
            }
        },
        {
            "name": "checkout",
            "description": "Purchases products in the cart and completes the order. Use for requests like 'complete order', 'buy', 'pay', 'confirm cart'.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "username": {"type": "STRING", "description": f"Always use '{username}'"}
                },
                "required": ["username"]
            }
        },
        {
            "name": "get_my_orders",
            "description": "Lists past orders. Use for requests like 'my orders', 'what did i order', 'past orders'.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "username": {"type": "STRING", "description": f"Always use '{username}'"}
                },
                "required": ["username"]
            }
        },
    ]

async def call_mcp_gateway(method_name: str, arguments: dict, auth_token: str) -> str:
    print(f"🔑 Token first 50 chars: {auth_token[:50]}")
    print(f"🔧 Call: {method_name} {arguments}")
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": method_name, "arguments": arguments}
    }
    headers = {
        "Authorization": auth_token,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "mcp-protocol-version": "2024-11-05"
    }
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.post(GATEWAY_URL, json=payload, headers=headers, timeout=20.0)
            if response.status_code == 403:
                return "ERROR: You do not have permission for this action."
            raw = response.text
            if raw.startswith("data:"):
                raw = raw[len("data:"):].strip()
            result = json.loads(raw)
            if "result" in result and "content" in result["result"]:
                return result["result"]["content"][0].get("text", "Result empty.")
            if "result" in result and "result" in result["result"]:
                return str(result["result"]["result"])
            return f"Error: {result.get('error', {}).get('message', 'Unknown error')}"
        except Exception as e:
            return f"Connection Error: {str(e)}"

@app.post("/chat")
async def chat_with_agent(request: ChatRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token missing!")

    username        = decode_username(authorization)
    tools_definition = get_tools_definition(username)

    try:
        chat = client.chats.create(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction=f"""You are an e-commerce assistant.
USERNAME: {username}

CRITICAL RULES:
1. Call tools DIRECTLY, never ask for confirmation or permission.
2. For any tool requiring username or seller_username parameter, use '{username}'.
3. If you get an authorization error (ERROR: You do not have permission for this action), just say 'You do not have permission for this action'.
4. If period is not specified, use 'this_month'.
5. If price is in dollars, convert 1 USD = 35 TL.
6. Give short and clear answers.""",
                tools=[{"function_declarations": tools_definition}]
            )
        )

        response = chat.send_message(request.message)

        for _ in range(5):
            parts = response.candidates[0].content.parts
            fc = next((p for p in parts if hasattr(p, 'function_call') and p.function_call), None)
            if not fc:
                break

            call = fc.function_call
            tool_result = await call_mcp_gateway(call.name, dict(call.args), authorization)
            print(f"🔧 {call.name} → {tool_result[:80]}")

            response = chat.send_message(
                types.Part(
                    function_response=types.FunctionResponse(
                        name=call.name,
                        response={"result": tool_result}
                    )
                )
            )

        # response.text None gelebilir, güvenli al
        final_text = response.text
        if not final_text:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    final_text = part.text
                    break

        return {"message": final_text or "Process completed.", "status": "success"}

    except Exception as e:
        print(f"❌ {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)