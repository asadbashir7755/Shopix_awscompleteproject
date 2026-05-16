import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const { productId, wishlistId } = await request.json();

        if (!productId || !wishlistId) {
            return NextResponse.json({ error: "Product ID and Wishlist ID are required", success: false }, { status: 400 });
        }

        // Check if already in cart
        const [cartExisting] = await pool.execute(
            'SELECT id FROM cart WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );

        if ((cartExisting as any[]).length === 0) {
            // Add to cart
            await pool.execute(
                'INSERT INTO cart (user_id, product_id) VALUES (?, ?)',
                [userId, productId]
            );
        }

        // Remove from wishlist
        await pool.execute(
            'DELETE FROM wishlist WHERE id = ? AND user_id = ?',
            [wishlistId, userId]
        );

        return NextResponse.json({ message: "Moved to cart successfully", success: true }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
