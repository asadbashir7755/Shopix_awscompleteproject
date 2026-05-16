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

        // Check if already in cart
        const [existing] = await pool.execute(
            'SELECT id FROM cart WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );

        if ((existing as any[]).length > 0) {
            return NextResponse.json({ error: "Product already in your items", success: false }, { status: 400 });
        }

        await pool.execute(
            'INSERT INTO cart (user_id, product_id) VALUES (?, ?)',
            [userId, productId]
        );

        return NextResponse.json({ message: "Added to items successfully", success: true }, { status: 201 });

    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Get cart items with product and store details
        const [cartItems] = await pool.execute(
            `SELECT
                c.id,
                c.user_id,
                c.product_id,
                p.*,
                s.name as store_name,
                s.logo as store_logo
            FROM cart c
            JOIN products p ON c.product_id = p.id
            JOIN stores s ON p.store_id = s.id
            WHERE c.user_id = ?
            ORDER BY c.created_at DESC`,
            [userId]
        );

        return NextResponse.json({ success: true, data: cartItems }, { status: 200 });
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
            return NextResponse.json({ error: "Item ID is required", success: false }, { status: 400 });
        }

        await pool.execute(
            'DELETE FROM cart WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        return NextResponse.json({ message: "Item removed successfully", success: true }, { status: 200 });
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}
