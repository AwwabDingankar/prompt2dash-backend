const schemaContext = `
You have access to a PostgreSQL database with these tables:

Table: customers
- id (integer, primary key)
- name (text)
- email (text)
- signup_date (date)

Table: products
- id (integer, primary key)
- name (text)
- category (text) — e.g. Electronics, Books, Sports, Home & Kitchen
- price (numeric)

Table: orders
- id (integer, primary key)
- customer_id (integer, references customers.id)
- product_id (integer, references products.id)
- region (text) — e.g. North, South, East, West, Central
- quantity (integer)
- unit_price (numeric) — price PER UNIT for this order line, NOT the total. To get the line total, multiply quantity * unit_price.
- order_date (date)

Table: sales (this is a VIEW — a pre-joined, ready-to-query combination of orders, customers, and products)
- order_id (integer)
- customer_name (text)
- product_name (text)
- category (text)
- region (text)
- quantity (integer)
- unit_price (numeric)
- revenue (numeric) — already calculated as quantity * unit_price, use this directly, no need to multiply again
- order_date (date)

Prefer using the sales view over manually joining orders/customers/products when the question involves customer names, product names, or categories — it's simpler and less error-prone.

Important calculation rule:
- To calculate revenue, total spent, or total sales, always compute quantity * unit_price, and use SUM() when aggregating across rows. Never just SUM(unit_price) alone — that ignores quantity and gives an incorrect result.
`;

module.exports = schemaContext;