import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { pusherServer } from "@/src/lib/pusher";

// GET: Fetch all messages for a conversation
export async function GET(request: NextRequest, { params }: { params: any }) {
    try {
        await VerifyToken(request);
        const { conversationId } = await params;

        const [messages] = await pool.execute(
            `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
            [conversationId]
        );

        return NextResponse.json({ success: true, messages });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Send a message
export async function POST(request: NextRequest, { params }: { params: any }) {
    try {
        const userId = VerifyToken(request);
        const { conversationId } = await params;
        const { message, senderRole } = await request.json();

        if (!message) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        // 1. Create the message
        const [insertResult] = await pool.execute(
            `INSERT INTO messages (conversation_id, sender_id, sender_role, message, is_read)
             VALUES (?, ?, ?, ?, 0)`,
            [conversationId, userId, senderRole, message]
        );

        const [newMessageRows] = await pool.execute(
            `SELECT * FROM messages WHERE id = ? LIMIT 1`,
            [(insertResult as any).insertId]
        );
        const newMessage = (newMessageRows as any[])[0];

        // 2. Update conversation last message and timestamp
        await pool.execute(
            `UPDATE conversations SET last_message = ?, updated_at = NOW() WHERE id = ?`,
            [message, conversationId]
        );

        const [conversationRows] = await pool.execute(
            `SELECT c.*, p.name AS product_name,
                    cu.id AS customer_id, cu.name AS customer_name,
                    su.id AS seller_id, su.name AS seller_name
             FROM conversations c
             JOIN products p ON c.product_id = p.id
             JOIN users cu ON c.customer_id = cu.id
             JOIN users su ON c.seller_id = su.id
             WHERE c.id = ?
             LIMIT 1`,
            [conversationId]
        );

        const conversation: any = (conversationRows as any[])[0];

        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        // 3. Trigger Pusher
        await pusherServer.trigger(`conversation-${conversationId}`, "new-message", newMessage);

        // 4. Send Notification
        const isCustomer = senderRole === "customer";
        const recipientId = isCustomer ? conversation.seller_id : conversation.customer_id;
        const senderName = isCustomer ? conversation.customer_name : "Seller";
        const productName = conversation.product_name;

        await pool.execute(
            `INSERT INTO notifications (user_id, message, type, link, is_read)
             VALUES (?, ?, 'chat', ?, 0)`,
            [
                recipientId,
                isCustomer
                    ? `New message from ${senderName} about ${productName}`
                    : `Seller replied to your message about ${productName}`,
                isCustomer ? "/seller/chats" : `/products/productinfo?id=${conversation.product_id}&openChat=true`,
            ]
        );

        return NextResponse.json({ success: true, message: newMessage });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Mark messages in a conversation as read
export async function PATCH(request: NextRequest, { params }: { params: any }) {
    try {
        const userId = VerifyToken(request);
        const { conversationId } = await params;

        await pool.execute(
            `UPDATE messages
             SET is_read = 1
             WHERE conversation_id = ? AND sender_id <> ? AND is_read = 0`,
            [conversationId, userId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
