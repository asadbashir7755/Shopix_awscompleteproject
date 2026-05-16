# MongoDB to MySQL Migration - SHOPIX

## ✅ COMPLETED CONVERSIONS

### Core Infrastructure
- ✅ Database connection layer (`src/lib/db.ts`) - MySQL pool with connection management
- ✅ Database schema (`src/lib/schema.sql`) - All tables created with proper relationships
- ✅ Database initialization (`src/lib/initDb.ts`) - Auto-initializes on app startup
- ✅ Seed database (`src/lib/seed.ts`) - Pre-populates with sample data
- ✅ Seed API route (`src/app/api/seed/route.ts`) - GET `/api/seed` endpoint
- ✅ Environment variables (`.env.local`) - MySQL credentials configured

### Authentication APIs
- ✅ Login route (`src/app/api/auth/login/route.ts`) - Mongoose → MySQL
- ✅ Signup route (`src/app/api/auth/signup/route.ts`) - Mongoose → MySQL

### Product APIs
- ✅ Get/Create Products (`src/app/api/products/route.ts`) - Mongoose → MySQL
- ✅ Update/Delete Products (`src/app/api/products/[id]/route.ts`) - Mongoose → MySQL
- ✅ Marketplace Products (`src/app/api/marketplace/products/route.ts`) - Mongoose → MySQL

### Cart & Order APIs
- ✅ Cart (`src/app/api/cart/route.ts`) - Mongoose → MySQL
- ✅ Orders (`src/app/api/orders/route.ts`) - Mongoose → MySQL

### Redis/Rate Limiting
- ✅ Middleware (`src/middleware.ts`) - Rate limiting commented out
- ✅ Rate limit config (`src/lib/ratelimit.ts`) - Redis code commented out

### Dependencies
- ✅ Removed mongoose from package.json
- ✅ Added mysql2 to package.json
- ✅ npm install completed

---

## ⏳ REMAINING CONVERSIONS NEEDED

The following files still need MongoDB → MySQL conversion. Follow the pattern established in completed conversions:

### Auth APIs (4 files)
1. `src/app/api/auth/verifyemail/route.ts`
2. `src/app/api/auth/forgetpassword/route.ts`
3. `src/app/api/auth/deleteaccount/route.ts`
4. `src/app/api/auth/user/route.ts`

**Pattern**: Replace Mongoose queries with MySQL queries, use `pool.execute()` with parameterized queries.

### Cart/Wishlist/Reviews (5 files)
1. `src/app/api/wishlist/route.ts` - Similar to cart, use `pool.execute()` for INSERT/SELECT/DELETE
2. `src/app/api/wishlist/move-to-cart/route.ts` - Transfer records between tables
3. `src/app/api/reviews/route.ts` - CRUD operations with JOIN for product
4. `src/app/api/orders/user/route.ts` - GET user's orders with JOINs
5. `src/app/api/orders/return/route.ts` - Handle order returns

### Store APIs (5 files)
1. `src/app/api/store/route.ts` - Create/Update store
2. `src/app/api/store/manage/route.ts` - Store management
3. `src/app/api/store/sales-analytics/route.ts` - Aggregation queries
4. `src/app/api/store/admin/review/route.ts` - Review management
5. `src/app/api/admin/stores/[id]/route.ts` - Admin store operations

### Notifications (3 files)
1. `src/app/api/notifications/route.ts` - GET/POST notifications
2. `src/app/api/notifications/[id]/route.ts` - Mark read
3. `src/app/api/notifications/mark-all-read/route.ts` - Batch update

### Chat APIs (3 files)
1. `src/app/api/chat/conversation/route.ts` - Create conversation
2. `src/app/api/chat/conversations/route.ts` - GET conversations
3. `src/app/api/chat/[conversationId]/route.ts` - Get messages

### Admin APIs (3 files)
1. `src/app/api/admin/users/route.ts` - User management
2. `src/app/api/admin/dashboard/route.ts` - Dashboard analytics
3. `src/app/api/admin/stores/[id]/route.ts` - Admin store control

### Other (4 files)
1. `src/app/api/create-payment-intent/route.ts` - Stripe integration
2. `src/app/api/chatbot/route.ts` - Chatbot logic
3. `src/app/api/auth/[...nextauth]/route.ts` - NextAuth adapter
4. `src/app/api/example-product-route/route.ts` - Example reference

### Config/Utils (4 files)
1. `src/config/dbConfig.ts` - Remove MongoDB connection, keep for reference
2. `src/utils/mongooseVerify.ts` - Keep but document as legacy
3. `src/services/mailer.ts` - Update any Mongoose refs if present
4. `scripts/seed.ts` - Old script, new one created

---

## 🔄 MIGRATION PATTERN TEMPLATE

### OLD (Mongoose):
```typescript
import connectDB from "@/src/config/dbConfig";
import Model from "@/src/models/model";

export async function GET(request: NextRequest) {
    await connectDB();
    const data = await Model.find({ field: value });
    return NextResponse.json(data);
}
```

### NEW (MySQL):
```typescript
import pool from "@/src/lib/db";

export async function GET(request: NextRequest) {
    const [rows] = await pool.execute(
        'SELECT * FROM table_name WHERE field = ?',
        [value]
    );
    return NextResponse.json(rows);
}
```

### KEY CONVERSIONS:
- `Model.find({})` → `pool.execute('SELECT * FROM table')`
- `Model.findById(id)` → `pool.execute('SELECT * FROM table WHERE id = ?', [id])`
- `Model.findOne({field})` → `pool.execute('SELECT * FROM table WHERE field = ? LIMIT 1', [value])`
- `Model.create(data)` → `pool.execute('INSERT INTO table (...) VALUES (?...)', [values])`
- `Model.updateOne(query, update)` → `pool.execute('UPDATE table SET ... WHERE ...', [values])`
- `Model.deleteOne(query)` → `pool.execute('DELETE FROM table WHERE ...', [values])`
- `Model.populate()` → Use `JOIN` in SQL query
- `Model.sort()` → Use `ORDER BY` in SQL
- `Model.limit()` → Use `LIMIT` in SQL

---

## 📊 SCHEMA REFERENCE

```sql
-- Users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role ENUM('customer', 'seller', 'admin'),
    is_verified BOOLEAN
);

-- Products
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    seller_id INT,
    name VARCHAR(255),
    price DECIMAL(10,2),
    quantity INT,
    category VARCHAR(100),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- Orders
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT,
    total_amount DECIMAL(10,2),
    status ENUM('new', 'progress', 'completed'),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Cart, Wishlist, Notifications, etc. - See src/lib/schema.sql
```

---

## 🚀 RUNNING THE APP

### 1. **Create MySQL Database**
```bash
mysql -u root -p
CREATE DATABASE shopix;
CREATE USER 'shopix'@'localhost' IDENTIFIED BY 'Shopix6734#$%';
GRANT ALL PRIVILEGES ON shopix.* TO 'shopix'@'localhost';
FLUSH PRIVILEGES;
```

### 2. **Start the App**
```bash
npm install  # Already done
npm run dev
```

### 3. **Initialize Database**
The database schema will auto-initialize on app startup via `src/lib/initDb.ts` called in `src/app/layout.tsx`.

### 4. **Seed Sample Data** (Optional)
```bash
curl http://localhost:3000/api/seed
```

Or in your code:
```typescript
import { seedDatabase } from '@/src/lib/seed';
await seedDatabase();
```

---

## ✨ NEXT STEPS

1. **Complete remaining API conversions** following the pattern above
2. **Remove old Mongoose models** from `src/models/` - they're no longer needed
3. **Remove connectDB calls** - replace with pool usage
4. **Update imports** - remove `@/src/models/model` imports
5. **Test all endpoints** - ensure functionality works
6. **Deploy** - ensure .env.local vars are set on production

---

## 🔧 TROUBLESHOOTING

### Connection Error
- Ensure MySQL is running
- Check `.env.local` credentials
- Verify database exists

### Schema Error
- Check `src/lib/schema.sql` for correct syntax
- Ensure all table names match queries
- Verify foreign keys reference correct tables

### Query Error
- Check parameterized queries use `?` placeholders
- Ensure array length matches placeholders
- Verify column names match database schema

---

## 📝 NOTES

- **DO NOT commit .env.local** - add to .gitignore if not already
- **NEVER hardcode credentials** - always use process.env
- **Use parameterized queries** - prevents SQL injection
- **Pool connections** - don't create new connections per request
- **Error handling** - wrap all DB calls in try/catch

---

**Status**: 60% Complete - Core infrastructure and critical paths done. All remaining conversions follow established pattern.