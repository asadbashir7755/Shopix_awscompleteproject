import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Get notifications
        const [notifications] = await pool.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );

        // Get unread count
        const [countRows] = await pool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        const unreadCount = (countRows as any[])[0].count;

        return NextResponse.json({ success: true, data: notifications, unreadCount }, { status: 200 });
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}
