import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { sendStoreCreationEmail, sendStoreRejectionEmail, sendStoreFrozenEmail, sendStoreDeletionEmail } from "@/src/services/storeEmail";
import { deleteFromCloudinary } from "@/src/services/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [userId]);
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }

        // Get all stores with their seller info for review
        const [stores] = await pool.execute(
            `SELECT s.*, u.name AS seller_name, u.email AS seller_email
             FROM stores s
             LEFT JOIN users u ON s.seller_id = u.id
             ORDER BY s.created_at DESC`
        );
        return NextResponse.json({ success: true, data: stores }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [userId]);
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }

        const { storeId, status } = await request.json(); // status: 'approved' | 'rejected'
        if (!storeId || !status) {
            return NextResponse.json({ error: "Store ID and status are required", success: false }, { status: 400 });
        }

        await pool.execute(`UPDATE stores SET status = ? WHERE id = ?`, [status, storeId]);
        const [storeRows] = await pool.execute(
            `SELECT s.*, u.name AS seller_name, u.email AS seller_email
             FROM stores s
             LEFT JOIN users u ON s.seller_id = u.id
             WHERE s.id = ? LIMIT 1`,
            [storeId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found", success: false }, { status: 404 });
        }
        const updatedStore = (storeRows as any[])[0];

        // Send email notification to seller
        const seller: any = { name: updatedStore.seller_name, email: updatedStore.seller_email };
        if (seller && seller.email) {
            if (status === "approved") {
                await sendStoreCreationEmail({
                    email: seller.email,
                    sellerName: seller.name,
                    storeName: updatedStore.name
                });
            } else if (status === "rejected") {
                await sendStoreRejectionEmail({
                    email: seller.email,
                    sellerName: seller.name,
                    storeName: updatedStore.name,
                    reason: "Your store does not meet our platform requirements at this time."
                });
            } else if (status === "frozen") {
                await sendStoreFrozenEmail({
                    email: seller.email,
                    sellerName: seller.name,
                    storeName: updatedStore.name,
                    reason: "Your store has been frozen due to a policy violation or maintenance requirement."
                });
            }
        }

        // --- In-App Notification for Seller ---
        try {
            let notifMessage = "";
            if (status === "approved") notifMessage = `Congratulations! Your store "${updatedStore.name}" has been approved.`;
            else if (status === "rejected") notifMessage = `Your store "${updatedStore.name}" application was rejected.`;
            else if (status === "frozen") notifMessage = `Your store "${updatedStore.name}" has been frozen by an administrator.`;

            if (notifMessage) {
                await pool.execute(
                    `INSERT INTO notifications (user_id, message, type, link, is_read)
                     VALUES (?, ?, 'store', '/store/dashboard', 0)`,
                    [updatedStore.seller_id, notifMessage]
                );
            }
        } catch (notifError) {
            console.error("Failed to create in-app notification:", notifError);
        }

        const actionText = status === 'frozen' ? 'frozen' : (status === 'approved' ? 'approved/unfrozen' : status);
        return NextResponse.json({ success: true, message: `Store ${actionText} successfully`, data: updatedStore }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const [adminRows] = await pool.execute(
            `SELECT id, role, password FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        if ((adminRows as any[]).length === 0 || (adminRows as any[])[0].role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Admin access only.", success: false }, { status: 403 });
        }
        const admin = (adminRows as any[])[0];

        const { storeId, password } = await request.json();
        if (!storeId || !password) {
            return NextResponse.json({ error: "Store ID and password are required", success: false }, { status: 400 });
        }

        // Verify admin password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Authentication failed. Incorrect password.", success: false }, { status: 401 });
        }

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
        const storeToDelete = (storeRows as any[])[0];

        const seller: any = { name: storeToDelete.seller_name, email: storeToDelete.seller_email };
        const storeName = storeToDelete.name;

        // Delete logo from Cloudinary
        if (storeToDelete.logo) {
            await deleteFromCloudinary(storeToDelete.logo);
        }

        await pool.execute(`DELETE FROM stores WHERE id = ?`, [storeId]);

        // Send store deletion email to seller
        if (seller && seller.email) {
            await sendStoreDeletionEmail({
                email: seller.email,
                sellerName: seller.name,
                storeName: storeName
            });
        }

        return NextResponse.json({ success: true, message: "Store deleted successfully" }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
