import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        return NextResponse.json({ success: true, message: "All notifications marked as read" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
