import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/src/services/cloudinary";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const formData = await request.formData();
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const price = Number(formData.get("price"));
        const quantity = Number(formData.get("quantity"));
        const file = formData.get("image") as File;

        if (!name || !description || isNaN(price) || isNaN(quantity) || !file) {
            return NextResponse.json({ error: "All fields are required.", success: false }, { status: 400 });
        }

        if (description.length > 250) {
             return NextResponse.json({ error: "Description must be maximum 250 characters", success: false }, { status: 400 });
        }

        // Check if user has an approved store
        const [storeRows] = await pool.execute(
            'SELECT id FROM stores WHERE seller_id = ? AND status = ?',
            [userId, 'approved']
        );

        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "You must have an approved store to add products", success: false }, { status: 403 });
        }

        const store = (storeRows as any[])[0];

        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(file, "products");

        const [result] = await pool.execute(
            'INSERT INTO products (store_id, seller_id, name, description, price, quantity, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [store.id, userId, name, description, price, quantity, imageUrl]
        );

        const productId = (result as any).insertId;

        // Get the created product
        const [productRows] = await pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        const newProduct = (productRows as any[])[0];

        return NextResponse.json({ success: true, message: "Product added successfully", data: newProduct }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const [storeRows] = await pool.execute(
            'SELECT id FROM stores WHERE seller_id = ?',
            [userId]
        );

        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }

        const store = (storeRows as any[])[0];

        const [productRows] = await pool.execute(
            'SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC',
            [store.id]
        );

        // Cast numeric fields
        const sanitizedProducts = (productRows as any[]).map(p => ({
            ...p,
            price: Number(p.price),
            rating: Number(p.rating),
            sold: Number(p.sold),
            quantity: Number(p.quantity)
        }));

        return NextResponse.json({ success: true, products: sanitizedProducts }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
