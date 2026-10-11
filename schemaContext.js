const schemaContext = `
You have access to a PostgreSQL analytics database with the following tables and views:

Table: customers
- id (integer, primary key)
- name (text) — e.g. "Aarav Sharma", "Priya Patel", "Rahul Verma", "Sneha Rao", "Vikram Singh"
- email (text)
- signup_date (date)

Table: products
- id (integer, primary key)
- name (text) — e.g. "Wireless Mouse", "Mechanical Keyboard", "Yoga Mat", "Running Shoes", "Novel: The Silent Hour", "Python Crash Course", "Smart LED Bulb", "Laptop Stand"
- category (text) — exactly 4 distinct categories: 'Electronics', 'Sports', 'Books', 'Home & Kitchen'
- price (numeric) — unit price

Table: orders
- id (integer, primary key)
- customer_id (integer, foreign key referencing customers.id)
- product_id (integer, foreign key referencing products.id)
- region (text) — exactly 5 distinct regions: 'North', 'South', 'East', 'West', 'Central'
- quantity (integer) — number of units ordered
- unit_price (numeric) — price per unit
- order_date (date) — recorded between 2025-01-19 and 2025-07-27

View: sales (PRE-JOINED AND HIGHLY RECOMMENDED FOR ALMOST ALL QUERIES)
- order_id (integer)
- customer_name (text)
- product_name (text)
- category (text) — 'Electronics', 'Sports', 'Books', 'Home & Kitchen'
- region (text) — 'North', 'South', 'East', 'West', 'Central'
- quantity (integer) — units sold
- unit_price (numeric)
- revenue (numeric) — pre-computed as quantity * unit_price (no need to multiply again)
- order_date (date) — spans January 2025 to July 2025

CRITICAL QUERY GUIDELINES:
1. Historical Dataset Range:
   - The transactions span from January 2025 to July 2025.
   - NEVER filter by CURRENT_DATE, CURRENT_TIMESTAMP, or NOW() - INTERVAL '...', because that will return empty datasets. Filter by specific dates (e.g. order_date >= '2025-01-01') or analyze the full 2025 dataset.
2. Prefer the 'sales' view:
   - For all category, product, region, customer, or time-series revenue questions, query the 'sales' view directly.
3. PostgreSQL Aggregation & Rounding:
   - Always cast and round numeric calculations:
     ROUND(SUM(revenue)::numeric, 2) AS revenue
     ROUND(AVG(revenue)::numeric, 2) AS avg_value
     COUNT(order_id) AS total_orders
     COUNT(DISTINCT customer_name) AS customer_count
4. Monthly Trends:
   - To group by month chronologically:
     SELECT TO_CHAR(order_date, 'Mon YYYY') AS month, ROUND(SUM(revenue)::numeric, 2) AS revenue
     FROM sales
     GROUP BY TO_CHAR(order_date, 'Mon YYYY'), DATE_TRUNC('month', order_date)
     ORDER BY DATE_TRUNC('month', order_date) ASC;
5. Column Naming & Aliases:
   - Always use simple, clean lowercase snake_case aliases without spaces: "month", "revenue", "category", "region", "product_name", "units_sold", "value".
`;

module.exports = schemaContext;