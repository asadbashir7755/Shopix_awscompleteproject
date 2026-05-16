import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { sendEmail } from "@/src/services/mailer";
import bcrypt from "bcryptjs";

import { VerifyToken } from "@/src/utils/VerifyToken";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 1️⃣ Send reset email
        if (body.email) {
            const [rows] = await pool.execute(
                `SELECT id FROM users WHERE email = ? LIMIT 1`,
                [body.email]
            );

            if ((rows as any[]).length === 0) {
                return NextResponse.json({ message: "User not found" }, { status: 404 });
            }

            const user = (rows as any[])[0];

            await sendEmail({ email: body.email, emailType: "RESET", userId: String(user.id) });
            return NextResponse.json({
                message: "Reset password link sent to your email",
                success: true,
            }, { status: 201 });
        }

        // 2️⃣ Reset password (Admin Direct)
        if (body.isAdminReset && body.newPassword) {
            const userId = VerifyToken(request);
            const [userRows] = await pool.execute(
                `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
                [userId]
            );

            if ((userRows as any[]).length === 0) {
                return NextResponse.json({ message: "User not found" }, { status: 404 });
            }

            const user = (userRows as any[])[0];

            if (user.role !== "admin") {
                return NextResponse.json({ message: "Action unauthorized. Admin only." }, { status: 403 });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(body.newPassword, salt);
            await pool.execute(
                `UPDATE users SET password = ? WHERE id = ?`,
                [hashed, userId]
            );

            return NextResponse.json({ message: "Admin password updated successfully", success: true });
        }

        // 3️⃣ Token-based Reset
        if (body.token && body.newPassword) {
            const [rows] = await pool.execute(
                `SELECT id FROM users
                 WHERE forgot_password_token = ? AND forgot_password_token_expiry > NOW()
                 LIMIT 1`,
                [body.token]
            );

            if ((rows as any[]).length === 0) {
                return NextResponse.json({ message: "Invalid or expired token" }, { status: 400 });
            }

            const user = (rows as any[])[0];

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(body.newPassword, salt);

            // Clear token
            await pool.execute(
                `UPDATE users
                 SET password = ?, forgot_password_token = NULL, forgot_password_token_expiry = NULL
                 WHERE id = ?`,
                [hashed, user.id]
            );

            return NextResponse.json({ message: "Password updated successfully", success: true });
        }

        return NextResponse.json({ message: "Invalid request" }, { status: 400 });

    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ message: "Internal server error", error: error.message }, { status });
    }
}
