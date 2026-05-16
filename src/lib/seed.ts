import bcrypt from 'bcryptjs';
import pool from './db';

interface SeedOptions {
  force?: boolean;
}

interface User {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: 'customer' | 'seller' | 'admin';
  is_verified: boolean;
}

interface Store {
  id?: number;
  seller_id: number;
  name: string;
  description: string;
  type: 'Individual' | 'Company';
  logo: string;
  status: 'pending' | 'approved' | 'rejected' | 'frozen';
}

interface Product {
  id?: number;
  store_id: number;
  seller_id: number;
  name: string;
  description: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
}

interface Order {
  id?: number;
  user_id: number;
  store_id: number;
  product_id: number;
  receiver_name: string;
  mobile_number: string;
  billing_address: string;
  quantity: number;
  payment_method: 'cod' | 'online';
  total_amount: number;
  status: 'new' | 'progress' | 'completed';
  payment_status: 'Pending' | 'Paid' | 'Failed';
}

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function checkExistingData(): Promise<boolean> {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const count = (rows as any)[0].count;
    return count > 0;
  } catch (error) {
    return false;
  }
}

async function clearAllSeedableData(): Promise<void> {
  // Delete in FK-safe order
  await pool.execute('DELETE FROM messages');
  await pool.execute('DELETE FROM conversations');
  await pool.execute('DELETE FROM notifications');
  await pool.execute('DELETE FROM reviews');
  await pool.execute('DELETE FROM wishlist');
  await pool.execute('DELETE FROM cart');
  await pool.execute('DELETE FROM orders');
  await pool.execute('DELETE FROM products');
  await pool.execute('DELETE FROM stores');
  await pool.execute('DELETE FROM faqs');
  await pool.execute('DELETE FROM users');
}

async function seedUsers(): Promise<User[]> {
  console.log('🌱 Seeding users...');

  const users: User[] = [
    {
      name: 'John Admin',
      email: 'admin@shopix.com',
      password: await hashPassword('admin123'),
      role: 'admin',
      is_verified: true,
    },
    {
      name: 'Alice Seller',
      email: 'alice@shopix.com',
      password: await hashPassword('seller123'),
      role: 'seller',
      is_verified: true,
    },
    {
      name: 'Bob Seller',
      email: 'bob@shopix.com',
      password: await hashPassword('seller123'),
      role: 'seller',
      is_verified: true,
    },
    {
      name: 'Charlie Customer',
      email: 'charlie@shopix.com',
      password: await hashPassword('customer123'),
      role: 'customer',
      is_verified: true,
    },
    {
      name: 'Diana Customer',
      email: 'diana@shopix.com',
      password: await hashPassword('customer123'),
      role: 'customer',
      is_verified: true,
    },
    {
      name: 'Eve Customer',
      email: 'eve@shopix.com',
      password: await hashPassword('customer123'),
      role: 'customer',
      is_verified: true,
    },
  ];

  const insertedUsers: User[] = [];

  for (const user of users) {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
      [user.name, user.email, user.password, user.role, user.is_verified]
    );
    insertedUsers.push({ ...user, id: (result as any).insertId });
  }

  console.log(`✅ Seeded ${insertedUsers.length} users`);
  return insertedUsers;
}

async function seedStores(users: User[]): Promise<Store[]> {
  console.log('🌱 Seeding stores...');

  const sellers = users.filter(u => u.role === 'seller');
  const stores: Store[] = [
    {
      seller_id: sellers[0].id!,
      name: 'Alice\'s Electronics',
      description: 'Premium electronics and gadgets for modern living',
      type: 'Individual',
      logo: 'https://picsum.photos/400/400?random=1',
      status: 'approved',
    },
    {
      seller_id: sellers[1].id!,
      name: 'Bob\'s Fashion Hub',
      description: 'Trendy clothing and accessories for everyone',
      type: 'Company',
      logo: 'https://picsum.photos/400/400?random=2',
      status: 'approved',
    },
  ];

  const insertedStores: Store[] = [];

  for (const store of stores) {
    const [result] = await pool.execute(
      'INSERT INTO stores (seller_id, name, description, type, logo, status) VALUES (?, ?, ?, ?, ?, ?)',
      [store.seller_id, store.name, store.description, store.type, store.logo, store.status]
    );
    insertedStores.push({ ...store, id: (result as any).insertId });
  }

  console.log(`✅ Seeded ${insertedStores.length} stores`);
  return insertedStores;
}

async function seedProducts(stores: Store[]): Promise<Product[]> {
  console.log('🌱 Seeding products...');

  const products: Product[] = [
    // Electronics from Alice's store
    {
      store_id: stores[0].id!,
      seller_id: stores[0].seller_id,
      name: 'Wireless Bluetooth Headphones',
      description: 'High-quality wireless headphones with noise cancellation',
      price: 199.99,
      quantity: 50,
      image: 'https://picsum.photos/400/400?random=3',
      category: 'Electronics',
    },
    {
      store_id: stores[0].id!,
      seller_id: stores[0].seller_id,
      name: 'Smartphone Case',
      description: 'Protective case for smartphones with card holder',
      price: 29.99,
      quantity: 100,
      image: 'https://picsum.photos/400/400?random=4',
      category: 'Accessories',
    },
    {
      store_id: stores[0].id!,
      seller_id: stores[0].seller_id,
      name: 'USB-C Cable',
      description: 'Fast charging USB-C cable, 6ft length',
      price: 15.99,
      quantity: 200,
      image: 'https://picsum.photos/400/400?random=5',
      category: 'Electronics',
    },
    // Fashion from Bob's store
    {
      store_id: stores[1].id!,
      seller_id: stores[1].seller_id,
      name: 'Cotton T-Shirt',
      description: 'Comfortable 100% cotton t-shirt in various colors',
      price: 24.99,
      quantity: 75,
      image: 'https://picsum.photos/400/400?random=6',
      category: 'Clothing',
    },
    {
      store_id: stores[1].id!,
      seller_id: stores[1].seller_id,
      name: 'Denim Jeans',
      description: 'Classic fit denim jeans, premium quality',
      price: 89.99,
      quantity: 30,
      image: 'https://picsum.photos/400/400?random=7',
      category: 'Clothing',
    },
    {
      store_id: stores[1].id!,
      seller_id: stores[1].seller_id,
      name: 'Leather Wallet',
      description: 'Genuine leather wallet with multiple card slots',
      price: 49.99,
      quantity: 40,
      image: 'https://picsum.photos/400/400?random=8',
      category: 'Accessories',
    },
    // More products
    {
      store_id: stores[0].id!,
      seller_id: stores[0].seller_id,
      name: 'Gaming Mouse',
      description: 'RGB gaming mouse with programmable buttons',
      price: 79.99,
      quantity: 25,
      image: 'https://picsum.photos/400/400?random=9',
      category: 'Electronics',
    },
    {
      store_id: stores[1].id!,
      seller_id: stores[1].seller_id,
      name: 'Running Shoes',
      description: 'Comfortable running shoes for all terrains',
      price: 129.99,
      quantity: 20,
      image: 'https://picsum.photos/400/400?random=10',
      category: 'Footwear',
    },
    {
      store_id: stores[0].id!,
      seller_id: stores[0].seller_id,
      name: 'Wireless Charger',
      description: 'Fast wireless charging pad for smartphones',
      price: 39.99,
      quantity: 60,
      image: 'https://picsum.photos/400/400?random=11',
      category: 'Electronics',
    },
    {
      store_id: stores[1].id!,
      seller_id: stores[1].seller_id,
      name: 'Sunglasses',
      description: 'UV protection sunglasses with polarized lenses',
      price: 69.99,
      quantity: 35,
      image: 'https://picsum.photos/400/400?random=12',
      category: 'Accessories',
    },
  ];

  const insertedProducts: Product[] = [];

  for (const product of products) {
    const [result] = await pool.execute(
      'INSERT INTO products (store_id, seller_id, name, description, price, quantity, image, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [product.store_id, product.seller_id, product.name, product.description, product.price, product.quantity, product.image, product.category]
    );
    insertedProducts.push({ ...product, id: (result as any).insertId });
  }

  console.log(`✅ Seeded ${insertedProducts.length} products`);
  return insertedProducts;
}

async function seedOrders(users: User[], stores: Store[], products: Product[]): Promise<void> {
  console.log('🌱 Seeding orders...');

  const customers = users.filter(u => u.role === 'customer');
  const orders: Order[] = [
    {
      user_id: customers[0].id!,
      store_id: stores[0].id!,
      product_id: products[0].id!,
      receiver_name: 'Charlie Customer',
      mobile_number: '+1234567890',
      billing_address: '123 Main St, City, State 12345',
      quantity: 1,
      payment_method: 'online',
      total_amount: 199.99,
      status: 'completed',
      payment_status: 'Paid',
    },
    {
      user_id: customers[1].id!,
      store_id: stores[1].id!,
      product_id: products[3].id!,
      receiver_name: 'Diana Customer',
      mobile_number: '+1234567891',
      billing_address: '456 Oak Ave, City, State 12346',
      quantity: 2,
      payment_method: 'cod',
      total_amount: 49.98,
      status: 'new',
      payment_status: 'Pending',
    },
    {
      user_id: customers[2].id!,
      store_id: stores[0].id!,
      product_id: products[1].id!,
      receiver_name: 'Eve Customer',
      mobile_number: '+1234567892',
      billing_address: '789 Pine Rd, City, State 12347',
      quantity: 1,
      payment_method: 'online',
      total_amount: 29.99,
      status: 'progress',
      payment_status: 'Paid',
    },
  ];

  for (const order of orders) {
    await pool.execute(
      'INSERT INTO orders (user_id, store_id, product_id, receiver_name, mobile_number, billing_address, quantity, payment_method, total_amount, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [order.user_id, order.store_id, order.product_id, order.receiver_name, order.mobile_number, order.billing_address, order.quantity, order.payment_method, order.total_amount, order.status, order.payment_status]
    );
  }

  console.log(`✅ Seeded ${orders.length} orders`);
}

async function seedFAQs(): Promise<void> {
  console.log('🌱 Seeding FAQs...');

  const faqs = [
    {
      question: 'How do I create an account?',
      answer: 'Click on the signup button and fill in your details. You will receive a verification email.',
      category: 'Account',
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page and click "Forgot Password". Enter your email and follow the instructions.',
      category: 'Account',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept credit cards, debit cards, and cash on delivery (COD).',
      category: 'Payment',
    },
    {
      question: 'How long does shipping take?',
      answer: 'Shipping typically takes 3-7 business days depending on your location.',
      category: 'Shipping',
    },
    {
      question: 'Can I return a product?',
      answer: 'Yes, you can return products within 30 days of delivery. Please check our return policy for details.',
      category: 'Returns',
    },
  ];

  for (const faq of faqs) {
    await pool.execute(
      'INSERT INTO faqs (question, answer, category) VALUES (?, ?, ?)',
      [faq.question, faq.answer, faq.category]
    );
  }

  console.log(`✅ Seeded ${faqs.length} FAQs`);
}

export async function seedDatabase(options: SeedOptions = {}) {
  try {
    console.log('🚀 Starting database seeding...');
    const force = !!options.force;

    if (force) {
      console.log('⚠️  Force reseed enabled: clearing existing data...');
      await clearAllSeedableData();
      console.log('✅ Existing data cleared');
    }

    // Check if data already exists
    const hasData = force ? false : await checkExistingData();
    if (hasData) {
      console.log('ℹ️  Database already has data, skipping seed...');
      return;
    }

    // Seed in order
    const users = await seedUsers();
    const stores = await seedStores(users);
    const products = await seedProducts(stores);
    await seedOrders(users, stores, products);
    await seedFAQs();

    console.log('🎉 Database seeding completed successfully!');
  } catch (error: any) {
    console.error('❌ Database seeding failed:', error.message);
    throw error;
  }
}