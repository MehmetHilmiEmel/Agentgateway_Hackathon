# core_api/db_server.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="Core DB API", description="E-Commerce Database Service (Port 8000)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "database.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.on_event("startup")
def startup_event():
    print("⏳ Initializing database...")
    conn = get_db_connection()

    # 1. Products
    conn.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_code TEXT UNIQUE,
            name TEXT,
            price REAL,
            stock INTEGER,
            seller_username TEXT,
            image_url TEXT
        )
    ''')

    # 2. Store statistics
    conn.execute('''
        CREATE TABLE IF NOT EXISTS store_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            period TEXT UNIQUE,
            revenue REAL,
            cost REAL
        )
    ''')

    # 3. Cart
    conn.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            product_code TEXT,
            quantity INTEGER DEFAULT 1,
            UNIQUE(username, product_code)
        )
    ''')

    # 4. Orders
    conn.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            product_code TEXT,
            product_name TEXT,
            quantity INTEGER,
            unit_price REAL,
            total_price REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Test data
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        conn.execute("INSERT INTO products (product_code, name, price, stock, seller_username, image_url) VALUES (?,?,?,?,?,?)",
                     ("MSI-LPT-001", "MSI Gaming Laptop", 1500.0, 10, "seller", None))
        conn.execute("INSERT INTO products (product_code, name, price, stock, seller_username, image_url) VALUES (?,?,?,?,?,?)",
                     ("APL-PHN-015", "iPhone 15 Pro", 1800.0, 25, "seller", None))

    cursor.execute("SELECT COUNT(*) FROM store_stats")
    if cursor.fetchone()[0] == 0:
        conn.execute("INSERT INTO store_stats VALUES (?,?,?,?)",
                     (None, "this_month", 7500.0, 2500.0))
        conn.execute("INSERT INTO store_stats VALUES (?,?,?,?)",
                     (None, "last_month", 5500.0, 1800.0))

    conn.commit()
    conn.close()
    print("✅ Database ready!")

# -- Data Models ----------------------------------------------------------------

class ProductCreate(BaseModel):
    product_code: str
    name: str
    price: float
    stock: int
    seller_username: Optional[str] = None
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    stock: int

class CartItem(BaseModel):
    username: str
    product_code: str
    quantity: int = 1

class CheckoutRequest(BaseModel):
    username: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str
    firstName: str
    lastName: str
    role: str = "buyer"

class LoginRequest(BaseModel):
    username: str
    password: str

# -- Product Endpoints ----------------------------------------------------------

@app.get("/products")
def get_all_products():
    conn = get_db_connection()
    products = conn.execute("SELECT * FROM products").fetchall()
    conn.close()
    return {"products": [dict(p) for p in products]}

@app.get("/products/seller/{seller_username}")
def get_seller_products(seller_username: str):
    conn = get_db_connection()
    products = conn.execute(
        "SELECT * FROM products WHERE seller_username = ?", (seller_username,)
    ).fetchall()
    conn.close()
    return {"products": [dict(p) for p in products]}

@app.get("/products/{product_code}")
def get_product(product_code: str):
    conn = get_db_connection()
    product = conn.execute(
        "SELECT * FROM products WHERE product_code = ?", (product_code,)
    ).fetchone()
    conn.close()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(product)

@app.post("/products")
def add_product(product: ProductCreate):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO products (product_code, name, price, stock, seller_username, image_url) VALUES (?, ?, ?, ?, ?, ?)",
            (product.product_code, product.name, product.price, product.stock,
             product.seller_username, product.image_url)
        )
        conn.commit()
        new_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="This product code already exists")
    conn.close()
    return {"message": "Product added successfully", "id": new_id}

@app.patch("/products/{product_code}/stock")
def update_stock(product_code: str, data: ProductUpdate):
    conn = get_db_connection()
    result = conn.execute(
        "UPDATE products SET stock = ? WHERE product_code = ?", (data.stock, product_code)
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Stock updated"}

@app.delete("/products/{product_code}")
def delete_product(product_code: str):
    conn = get_db_connection()
    result = conn.execute("DELETE FROM products WHERE product_code = ?", (product_code,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# -- Statistics Endpoints ----------------------------------------------------

@app.get("/stats/{period}")
def get_store_stats(period: str):
    conn = get_db_connection()
    stats = conn.execute(
        "SELECT * FROM store_stats WHERE period = ?", (period,)
    ).fetchone()
    conn.close()
    if not stats:
        raise HTTPException(status_code=404, detail="No data found for this period")
    return dict(stats)

# -- Cart Endpoints ---------------------------------------------------------

@app.get("/cart/{username}")
def get_cart(username: str):
    conn = get_db_connection()
    items = conn.execute('''
        SELECT c.product_code, c.quantity, p.name, p.price,
               (c.quantity * p.price) as subtotal
        FROM cart c
        JOIN products p ON c.product_code = p.product_code
        WHERE c.username = ?
    ''', (username,)).fetchall()
    conn.close()
    cart_list = [dict(i) for i in items]
    total = sum(i["subtotal"] for i in cart_list)
    return {"items": cart_list, "total": total}

@app.post("/cart")
def add_to_cart(item: CartItem):
    conn = get_db_connection()
    # Does the product exist and is stock sufficient?
    product = conn.execute(
        "SELECT * FROM products WHERE product_code = ?", (item.product_code,)
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")
    if product["stock"] < item.quantity:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient stock")
    try:
        conn.execute('''
            INSERT INTO cart (username, product_code, quantity)
            VALUES (?, ?, ?)
            ON CONFLICT(username, product_code)
            DO UPDATE SET quantity = quantity + ?
        ''', (item.username, item.product_code, item.quantity, item.quantity))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=400, detail=str(e))
    conn.close()
    return {"message": f"{product['name']} added to cart"}

@app.delete("/cart/{username}/{product_code}")
def remove_from_cart(username: str, product_code: str):
    conn = get_db_connection()
    result = conn.execute(
        "DELETE FROM cart WHERE username = ? AND product_code = ?", (username, product_code)
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="This product is not in the cart")
    return {"message": "Product removed from cart"}

@app.post("/cart/{username}/checkout")
def checkout(username: str):
    conn = get_db_connection()
    items = conn.execute('''
        SELECT c.product_code, c.quantity, p.name, p.price
        FROM cart c
        JOIN products p ON c.product_code = p.product_code
        WHERE c.username = ?
    ''', (username,)).fetchall()

    if not items:
        conn.close()
        raise HTTPException(status_code=400, detail="Cart is empty")

    total = 0
    for item in items:
        item = dict(item)
        subtotal = item["quantity"] * item["price"]
        total += subtotal

        # Write to order
        conn.execute('''
            INSERT INTO orders (username, product_code, product_name, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (username, item["product_code"], item["name"], item["quantity"], item["price"], subtotal))

        # Decrease stock
        conn.execute(
            "UPDATE products SET stock = stock - ? WHERE product_code = ?",
            (item["quantity"], item["product_code"])
        )

    # Clear cart
    conn.execute("DELETE FROM cart WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return {"message": "Order completed", "total": total}

@app.get("/orders/{username}")
def get_orders(username: str):
    conn = get_db_connection()
    orders = conn.execute(
        "SELECT * FROM orders WHERE username = ? ORDER BY created_at DESC", (username,)
    ).fetchall()
    conn.close()
    return {"orders": [dict(o) for o in orders]}

# -- Proxy Endpoints (For Dashboard) ---------------------------------------

@app.get("/proxy/jaeger/traces")
async def proxy_jaeger_traces(service: str = "agentgateway", limit: int = 50):
    import time
    end   = int(time.time() * 1000000)
    start = end - 3600 * 1000000
    async with httpx.AsyncClient() as client:
        res = await client.get("http://localhost:16686/api/traces",
                               params={"service": service, "start": start, "end": end, "limit": limit})
        return res.json()

@app.get("/proxy/gateway/metrics")
async def proxy_gateway_metrics():
    async with httpx.AsyncClient() as client:
        res = await client.get("http://localhost:3000/metrics")
        return {"data": res.text}

# -- Auth Endpoints ----------------------------------------------------------

@app.post("/register")
async def register_user(req: RegisterRequest):
    auth_url  = "http://localhost:8080/realms/master/protocol/openid-connect/token"
    auth_data = {"client_id": "admin-cli", "username": "admin", "password": "admin", "grant_type": "password"}

    async with httpx.AsyncClient() as client:
        auth_res    = await client.post(auth_url, data=auth_data)
        admin_token = auth_res.json()["access_token"]
        headers     = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

        user_data = {
            "username": req.username,
            "email": req.email,
            "firstName": req.firstName,
            "lastName": req.lastName,
            "enabled": True,
            "emailVerified": True,
            "requiredActions": [],
            "credentials": [{"type": "password", "value": req.password, "temporary": False}]
        }

        create_res = await client.post(
            "http://localhost:8080/admin/realms/mcp_demo/users", json=user_data, headers=headers
        )

        if create_res.status_code != 201:
            print(f"❌ Keycloak error: {create_res.status_code} - {create_res.text}")
            raise HTTPException(status_code=400, detail=f"Registration failed: {create_res.text}")

        user_id  = create_res.headers["Location"].split("/")[-1]
        role_res = await client.get(
            f"http://localhost:8080/admin/realms/mcp_demo/roles/{req.role}", headers=headers
        )
        role_info = role_res.json()

        await client.post(
            f"http://localhost:8080/admin/realms/mcp_demo/users/{user_id}/role-mappings/realm",
            json=[role_info], headers=headers
        )

    return {"message": "Registration successful"}

@app.post("/login")
async def login_user(req: LoginRequest):
    token_url = "http://localhost:8080/realms/mcp_demo/protocol/openid-connect/token"
    data = {
        "client_id": "mcp_client",
        "username": req.username,
        "password": req.password,
        "grant_type": "password",
        "scope": "openid"
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, data=data)

    if res.status_code != 200:
        print(f"❌ Keycloak Error: {res.status_code} - {res.text}")
        raise HTTPException(status_code=401, detail=f"Error: {res.json().get('error_description', 'Login failed')}")

    return res.json()

class RefreshRequest(BaseModel):
    refresh_token: str

@app.post("/refresh")
async def refresh_token(req: RefreshRequest):
    token_url = "http://localhost:8080/realms/mcp_demo/protocol/openid-connect/token"
    data = {
        "client_id": "mcp_client",
        "grant_type": "refresh_token",
        "refresh_token": req.refresh_token
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, data=data)

    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Refresh failed")

    return res.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
