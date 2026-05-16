import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: "Product ID is required", success: false }, { status: 400 });
        }

        // Check if already in wishlist
        const [existing] = await pool.execute(
            'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );

        if ((existing as any[]).length > 0) {
            // Toggle: remove if exists
            await pool.execute(
                'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
                [userId, productId]
            );
            return NextResponse.json({ message: "Removed from wishlist", success: true, removed: true }, { status: 200 });
        }

        // Add to wishlist
        await pool.execute(
            'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
            [userId, productId]
        );

        return NextResponse.json({ message: "Added to wishlist successfully", success: true }, { status: 201 });

    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Get wishlist items with product and store details
        const [wishlistItems] = await pool.execute(
            `SELECT
                w.id,
                w.user_id,
                w.product_id,
                p.*,
                s.name as store_name,
                s.logo as store_logo
            FROM wishlist w
            JOIN products p ON w.product_id = p.id
            JOIN stores s ON p.store_id = s.id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC`,
            [userId]
        );

        return NextResponse.json({ success: true, data: wishlistItems }, { status: 200 });
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Wishlist item ID is required", success: false }, { status: 400 });
        }

        await pool.execute(
            'DELETE FROM wishlist WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        return NextResponse.json({ message: "Wishlist item removed successfully", success: true }, { status: 200 });
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}
