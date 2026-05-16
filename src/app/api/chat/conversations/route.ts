import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Get conversations where user is either customer or seller
        const [conversations] = await pool.execute(
            `SELECT
                c.*,
                cu.id as customer_id, cu.name as customer_name, cu.email as customer_email,
                se.id as seller_id, se.name as seller_name, se.email as seller_email,
                p.id as product_id, p.name as product_name, p.image as product_image, p.price as product_price
            FROM conversations c
            JOIN users cu ON c.customer_id = cu.id
            JOIN users se ON c.seller_id = se.id
            JOIN products p ON c.product_id = p.id
            WHERE c.customer_id = ? OR c.seller_id = ?
            ORDER BY c.updated_at DESC`,
            [userId, userId]
        );

        // Add unread count for each conversation
        const conversationsWithUnread = await Promise.all(
            (conversations as any[]).map(async (conv) => {
                const [unreadResult] = await pool.execute(
                    `SELECT COUNT(*) as count FROM messages
                    WHERE conversation_id = ? AND is_read = FALSE AND sender_id != ?`,
                    [conv.id, userId]
                );
                return {
                    ...conv,
                    unreadCount: (unreadResult as any[])[0].count
                };
            })
        );

        return NextResponse.json({ success: true, conversations: conversationsWithUnread });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
