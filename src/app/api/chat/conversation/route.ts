import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const { sellerId, productId } = await request.json();

        if (!sellerId || !productId) {
            return NextResponse.json({ error: "Seller ID and Product ID are required" }, { status: 400 });
        }

        // Check if conversation already exists
        const [existingRows] = await pool.execute(
            `SELECT * FROM conversations
             WHERE customer_id = ? AND seller_id = ? AND product_id = ?
             LIMIT 1`,
            [userId, sellerId, productId]
        );

        let conversation: any;

        if ((existingRows as any[]).length === 0) {
            const [insertResult] = await pool.execute(
                `INSERT INTO conversations (customer_id, seller_id, product_id, last_message)
                 VALUES (?, ?, ?, '')`,
                [userId, sellerId, productId]
            );

            const [newRows] = await pool.execute(
                `SELECT * FROM conversations WHERE id = ? LIMIT 1`,
                [(insertResult as any).insertId]
            );

            conversation = (newRows as any[])[0];
        } else {
            conversation = (existingRows as any[])[0];
        }

        return NextResponse.json({ success: true, conversation });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
