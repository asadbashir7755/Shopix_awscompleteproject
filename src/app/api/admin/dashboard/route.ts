import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(
            `SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }
        const admin = (adminRows as any[])[0];

        const [totalUsersRows] = await pool.execute(`SELECT COUNT(*) AS totalUsers FROM users`);
        const [totalStoresRows] = await pool.execute(`SELECT COUNT(*) AS totalStores FROM stores`);
        const totalUsers = Number((totalUsersRows as any[])[0]?.totalUsers || 0);
        const totalStores = Number((totalStoresRows as any[])[0]?.totalStores || 0);

        const [userMonthlyRows] = await pool.execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
             FROM users
             WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)
             GROUP BY ym
             ORDER BY ym ASC`
        );

        const [storeMonthlyRows] = await pool.execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
             FROM stores
             WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)
             GROUP BY ym
             ORDER BY ym ASC`
        );

        // Format data for Recharts
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = [];
        
        for (let i = 0; i < 6; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            
            const userCount = Number((userMonthlyRows as any[]).find((u: any) => u.ym === ym)?.count || 0);
            const storeCount = Number((storeMonthlyRows as any[]).find((s: any) => s.ym === ym)?.count || 0);
            
            chartData.push({
                name: months[date.getMonth()],
                users: userCount,
                stores: storeCount
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                totalUsers,
                totalStores,
                chartData,
                admin: {
                    name: admin.name,
                    email: admin.email
                }
            }
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
