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
- total_amount (numeric)
- order_date (date)
`;

module.exports = schemaContext;