import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(
            `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }

        const { id: storeId } = await params;
        const [storeRows] = await pool.execute(
            `SELECT s.*, u.name AS seller_name, u.email AS seller_email
             FROM stores s
             LEFT JOIN users u ON s.seller_id = u.id
             WHERE s.id = ?
             LIMIT 1`,
            [storeId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }
        const store = (storeRows as any[])[0];

        const [products] = await pool.execute(
            `SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC`,
            [store.id]
        );

        // Calculate total sales from completed and non-returned orders
        const [salesRows] = await pool.execute(
            `SELECT COALESCE(SUM(total_amount), 0) AS totalSales
             FROM orders
             WHERE store_id = ?
               AND status = 'completed'
               AND return_status <> 'successful'`,
            [store.id]
        );
        const totalSales = Number((salesRows as any[])[0]?.totalSales || 0);

        return NextResponse.json({
            success: true,
            data: {
                store,
                products,
                totalSales
            }
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
