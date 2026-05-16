import { NextResponse, NextRequest } from "next/server";
import pool from "@/src/lib/db";

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ message: "Token is required", success: false }, { status: 400 });
        }

        // 1. Check for verification token
        const [verifyRows] = await pool.execute(
            `SELECT id FROM users
             WHERE verify_token = ? AND verify_token_expiry > NOW()
             LIMIT 1`,
            [token]
        );

        if ((verifyRows as any[]).length > 0) {
            const user = (verifyRows as any[])[0];
            await pool.execute(
                `UPDATE users
                 SET is_verified = 1,
                     verify_token = NULL,
                     verify_token_expiry = NULL
                 WHERE id = ?`,
                [user.id]
            );

            return NextResponse.json({
                message: "Email Verified Successfully",
                type: "verify",
                success: true
            }, { status: 200 });
        }

        // 2. Check for reset token (if handled by the same endpoint)
        const [resetRows] = await pool.execute(
            `SELECT id FROM users
             WHERE forgot_password_token = ? AND forgot_password_token_expiry > NOW()
             LIMIT 1`,
            [token]
        );

        if ((resetRows as any[]).length > 0) {
            return NextResponse.json({
                message: "Token is valid for password reset",
                type: "forget",
                success: true
            }, { status: 200 });
        }

        return NextResponse.json({
            message: "Invalid or expired token",
            success: false
        }, { status: 400 });

    } catch (error: any) {
        console.error("Verification Error:", error);
        return NextResponse.json({
            message: "Internal server error",
            success: false
        }, { status: 500 });
    }
}
