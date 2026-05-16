import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = VerifyToken(request);
        const { id } = await params;

        // Check if notification exists and belongs to user
        const [notifRows] = await pool.execute(
            'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if ((notifRows as any[]).length === 0) {
            return NextResponse.json({ error: "Notification not found", success: false }, { status: 404 });
        }

        // Mark as read
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        // Get updated notification
        const [updated] = await pool.execute(
            'SELECT * FROM notifications WHERE id = ?',
            [id]
        );

        const notification = (updated as any[])[0];

        return NextResponse.json({ success: true, data: notification }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
