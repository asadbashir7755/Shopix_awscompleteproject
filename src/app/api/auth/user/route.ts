import { NextRequest, NextResponse } from "next/server";
import { VerifyToken } from "@/src/utils/VerifyToken";
import pool from "@/src/lib/db";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request)
        const [rows] = await pool.execute(
            `SELECT id, name, email, role, is_verified, created_at, updated_at
             FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );

        if ((rows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 })
        }
        return NextResponse.json({ data: (rows as any[])[0], success: true, message: "User found" }, { status: 200 })
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const userId = VerifyToken(request)
        const { name, role } = await request.json();

        if (!name || !role) {
            return NextResponse.json({ error: "Name and role are required", success: false }, { status: 400 })
        }

        await pool.execute(
            `UPDATE users SET name = ?, role = ? WHERE id = ?`,
            [name, role, userId]
        );

        const [updatedRows] = await pool.execute(
            `SELECT id, name, email, role, is_verified, created_at, updated_at
             FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );

        if ((updatedRows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 })
        }

        return NextResponse.json({ data: (updatedRows as any[])[0], success: true, message: "Profile updated successfully" }, { status: 200 })
    } catch (error: any) {
        const status = error.message === "Token not found" || error.message === "jwt expired" ? 401 : 500;
        return NextResponse.json({ error: error.message, success: false }, { status });
    }
}