export const revalidate = 300;

import pool from "@/src/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/marketplace/products/[id]
 * Fetches product details with reviews
 * 
 * This follows the production-ready pattern:
 * 1. Connect to DB first
 * 2. Execute queries
 * 3. Handle errors properly
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Step 2: Extract product ID
        const { id } = await params;

        // Validate ID format
        if (!id || Number.isNaN(Number(id))) {
            return NextResponse.json(
                { error: "Invalid product ID format", success: false },
                { status: 400 }
            );
        }

        // Step 3: Execute both queries in parallel for better performance
        const [productRows, reviewRows] = await Promise.all([
            pool.execute(
                `SELECT p.*, s.name AS store_name, s.logo AS store_logo, s.description AS store_description, s.type AS store_type
                 FROM products p
                 LEFT JOIN stores s ON p.store_id = s.id
                 WHERE p.id = ?
                 LIMIT 1`,
                [id]
            ),
            pool.execute(
                `SELECT r.*, u.name AS user_name
                 FROM reviews r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.product_id = ?
                 ORDER BY r.created_at DESC`,
                [id]
            ),
        ]);

        const product = (productRows[0] as any[])[0];
        const reviews = reviewRows[0] as any[];

        // Step 4: Validate product exists
        if (!product) {
            return NextResponse.json(
                { error: "Product not found", success: false },
                { status: 404 }
            );
        }

        // Cast numeric fields
        const sanitizedProduct = {
            ...product,
            price: Number(product.price),
            rating: Number(product.rating),
            sold: Number(product.sold),
            quantity: Number(product.quantity)
        };

        const sanitizedReviews = (reviews || []).map(r => ({
            ...r,
            rating: Number(r.rating)
        }));

        // Step 5: Return successful response
        return NextResponse.json(
            {
                success: true,
                data: {
                    product: sanitizedProduct,
                    reviews: sanitizedReviews,
                },
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Product fetch error:", error);

        return NextResponse.json(
            {
                error: error.message || "Failed to fetch product details",
                success: false,
                details: process.env.NODE_ENV === "development" ? error : undefined,
            },
            { status: 500 }
        );
    }
}
