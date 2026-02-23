# mcp_server/tools.py
from fastmcp import FastMCP
import httpx

mcp = FastMCP(name="E-Commerce AI Tools")
DB_API_URL = "http://127.0.0.1:8000"

# ── COMMON TOOLS ────────────────────────────────────────────────────────────

@mcp.tool
async def list_products() -> str:
    """
    Returns a list of all products in the store.
    Use this when the user wants to see products, list them, or asks what we sell.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/products")
            res.raise_for_status()
            data = res.json()
            result = "Available Products:\n"
            for p in data.get("products", []):
                result += f"- [{p['product_code']}] {p['name']} | Price: {p['price']} Dollar | Stock: {p['stock']} units\n"
            return result
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def get_product_detail(product_code: str) -> str:
    """
    Returns all details of a specific product by its code.
    Use this when the user asks for detailed information, price, or stock of a specific product.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/products/{product_code}")
            if res.status_code == 404:
                return f"Error: Product with code {product_code} not found."
            res.raise_for_status()
            p = res.json()
            return (f"Product: {p['name']} (Code: {p['product_code']})\n"
                    f"Price: {p['price']} TL\n"
                    f"Stock: {p['stock']} units\n"
                    f"Seller: {p.get('seller_username', 'Unknown')}")
        except Exception as e:
            return f"Error: {str(e)}"

# ── SELLER TOOLS ──────────────────────────────────────────────────────────

@mcp.tool
async def add_product(product_code: str, name: str, price: float, stock: int, seller_username: str) -> str:
    """
    Adds a new product to the store. ONLY sellers can use this.
    Price must be in USD (dollars).
    """
    payload = {
        "product_code": product_code,
        "name": name,
        "price": price,
        "stock": stock,
        "seller_username": seller_username
    }
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{DB_API_URL}/products", json=payload)
            if res.status_code == 400:
                return f"Error: {res.json().get('detail', 'Invalid data')}"
            res.raise_for_status()
            return f"✅ Product '{name}' has been added to the system with code '{product_code}'."
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def get_my_products(seller_username: str) -> str:
    """
    Lists the products added by the seller. ONLY sellers can use this.
    Use this when the seller says 'my products' or 'show my products'.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/products/seller/{seller_username}")
            res.raise_for_status()
            data = res.json()
            products = data.get("products", [])
            if not products:
                return "You haven't added any products yet."
            result = f"Products of seller {seller_username}:\n"
            for p in products:
                result += f"- [{p['product_code']}] {p['name']} | {p['price']} Dollar | Stock: {p['stock']}\n"
            return result
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def update_product_stock(product_code: str, new_stock: int) -> str:
    """
    Updates the stock quantity of a product. ONLY sellers can use this.
    Use this when the seller wants to update or enter stock.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.patch(
                f"{DB_API_URL}/products/{product_code}/stock",
                json={"stock": new_stock}
            )
            if res.status_code == 404:
                return f"Error: Product with code {product_code} not found."
            res.raise_for_status()
            return f"✅ Stock of product {product_code} has been updated to {new_stock}."
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def delete_product(product_code: str) -> str:
    """
    Deletes a product from the system. ONLY sellers can use this.
    Use this when the seller wants to delete or remove a product.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.delete(f"{DB_API_URL}/products/{product_code}")
            if res.status_code == 404:
                return f"Error: Product with code {product_code} not found."
            res.raise_for_status()
            return f"✅ Product with code {product_code} has been deleted from the system."
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def get_store_profit_loss(period: str = "this_month") -> str:
    """
    Returns the store's profit/loss report. ONLY sellers can use this.
    Use this for questions like 'what did we earn this month' or 'profit report'.
    Valid values: 'this_month', 'last_month'
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/stats/{period}")
            if res.status_code == 404:
                return f"Error: No record found for period '{period}'."
            res.raise_for_status()
            data = res.json()
            profit = data['revenue'] - data['cost']
            return (f"Financial Report ({period}):\n"
                    f"Revenue: {data['revenue']} TL\n"
                    f"Cost: {data['cost']} TL\n"
                    f"Net Profit: {profit} TL")
        except Exception as e:
            return f"Error: {str(e)}"

# ── BUYER TOOLS ───────────────────────────────────────────────────────────

@mcp.tool
async def add_to_cart(username: str, product_code: str, quantity: int = 1) -> str:
    """
    Adds a product to the buyer's cart. ONLY buyers can use this.
    Use this when the user says 'add to cart' or 'i want to buy'.
    IMPORTANT: product_code must be the exact product code (e.g., MSI-LPT-001).
    If user says product name, first call list_products to find the exact code.
    Parameters:
    - username: Username of the buyer
    - product_code: Exact product code from the catalog
    - quantity: Quantity (default 1)
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{DB_API_URL}/cart",
                json={"username": username, "product_code": product_code, "quantity": quantity})
            if res.status_code in (400, 404):
                return f"Error: {res.json().get('detail', 'Operation failed')}"
            res.raise_for_status()
            return f"✅ {res.json().get('message', 'Product added to cart')}"
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def get_cart(username: str) -> str:
    """
    Lists the products in the buyer's cart. ONLY buyers can use this.
    Use this when the user says 'my cart' or 'show cart'.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/cart/{username}")
            res.raise_for_status()
            data = res.json()
            items = data.get("items", [])
            if not items:
                return "Your cart is empty."
            result = "🛒 Your Cart:\n"
            for item in items:
                result += f"- {item['name']} x{item['quantity']} | {item['price']} TL/each | Subtotal: {item['subtotal']} TL\n"
            result += f"\n💰 Total: {data['total']} TL"
            return result
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def remove_from_cart(username: str, product_code: str) -> str:
    """
    Removes a product from the buyer's cart. ONLY buyers can use this.
    Use this when the user wants to remove or delete a product from the cart.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.delete(f"{DB_API_URL}/cart/{username}/{product_code}")
            if res.status_code == 404:
                return "Error: This product is not in your cart."
            res.raise_for_status()
            return f"✅ Product removed from your cart."
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def checkout(username: str) -> str:
    """
    Confirms the buyer's cart and completes the order. ONLY buyers can use this.
    Use this when the user says 'buy', 'complete order', or 'pay'.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{DB_API_URL}/cart/{username}/checkout")
            if res.status_code == 400:
                return f"Error: {res.json().get('detail', 'Operation failed')}"
            res.raise_for_status()
            data = res.json()
            return (f"🎉 Your order is complete!\n"
                    f"Total Amount: {data['total']} TL\n"
                    f"Thank you!")
        except Exception as e:
            return f"Error: {str(e)}"

@mcp.tool
async def get_my_orders(username: str) -> str:
    """
    Lists the buyer's past orders. ONLY buyers can use this.
    Use this when the user says 'my orders' or 'past orders'.
    """
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{DB_API_URL}/orders/{username}")
            res.raise_for_status()
            data = res.json()
            orders = data.get("orders", [])
            if not orders:
                return "You don't have any orders yet."
            result = "📦 Your Orders:\n"
            for o in orders:
                result += (f"- {o['product_name']} x{o['quantity']} | "
                           f"{o['total_price']} Dollar | {o['created_at']}\n")
            return result
        except Exception as e:
            return f"Error: {str(e)}"

if __name__ == "__main__":
    print("🚀 FastMCP Server is starting on port 9000...")
    mcp.run(transport="http", host="127.0.0.1", port=9000)