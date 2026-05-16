import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendAccountDeletionEmail } from "@/src/services/welcome";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(
            `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }

        const [usersRows] = await pool.execute(
            `SELECT id, name, email, role, is_verified, created_at, updated_at
             FROM users
             WHERE role <> 'admin'
             ORDER BY created_at DESC`
        );
        const users = usersRows as any[];
        
        const customers = users.filter((user: any) => user.role === "customer");
        const sellers = users.filter((user: any) => user.role === "seller");

        return NextResponse.json({
            success: true,
            data: { customers, sellers }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userIdFromToken = VerifyToken(request);
        const [adminRows] = await pool.execute(
            `SELECT id, role, password FROM users WHERE id = ? LIMIT 1`,
            [userIdFromToken]
        );
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }
        const admin = (adminRows as any[])[0];

        const { userId, password } = await request.json();
        if (!userId || !password) {
            return NextResponse.json({ error: "User ID and password are required", success: false }, { status: 400 });
        }

        // Verify admin password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Authentication failed. Incorrect password.", success: false }, { status: 401 });
        }

        const [userRows] = await pool.execute(
            `SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((userRows as any[]).length === 0) {
            return NextResponse.json({ error: "User not found", success: false }, { status: 404 });
        }
        const user = (userRows as any[])[0];

        // Logic to delete everything related to user
        if (user.role === "seller") {
            const [storeRows] = await pool.execute(
                `SELECT id FROM stores WHERE seller_id = ? LIMIT 1`,
                [userId]
            );
            if ((storeRows as any[]).length > 0) {
                const store = (storeRows as any[])[0];
                await pool.execute(`DELETE FROM reviews WHERE product_id IN (SELECT id FROM products WHERE store_id = ?)`, [store.id]);
                await pool.execute(`DELETE FROM products WHERE store_id = ?`, [store.id]);
                await pool.execute(`DELETE FROM stores WHERE id = ?`, [store.id]);
            }
        }

        // Common things for both roles
        await pool.execute(`DELETE FROM reviews WHERE user_id = ?`, [userId]);
        await pool.execute(`DELETE FROM cart WHERE user_id = ?`, [userId]);
        await pool.execute(`DELETE FROM orders WHERE user_id = ?`, [userId]);
        
        // Final user deletion
        const userEmail = user.email;
        const userName = user.name;
        
        await pool.execute(`DELETE FROM users WHERE id = ?`, [userId]);

        // Send deletion notification email
        await sendAccountDeletionEmail({
            email: userEmail,
            username: userName
        });

        return NextResponse.json({
            success: true,
            message: "User and all associated data deleted successfully"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
