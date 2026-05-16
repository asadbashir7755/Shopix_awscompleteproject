import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary, deleteFromCloudinary } from "@/src/services/cloudinary";
import { sendAdminStoreNotificationEmail } from "@/src/services/storeEmail";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const [rows] = await pool.execute(
            `SELECT * FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        if ((rows as any[]).length > 0) {
            return NextResponse.json({ success: true, store: (rows as any[])[0] }, { status: 200 });
        } else {
            return NextResponse.json({ success: false, message: "No store found" }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const formData = await request.formData();
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const type = formData.get("type") as string;
        const file = formData.get("logo") as File;

        if (!name || !description || !type || !file) {
            return NextResponse.json({ error: "All fields are required. Please fill in all inputs and upload a logo.", success: false }, { status: 400 });
        }

        if (name.length < 4) {
            return NextResponse.json({ error: "Store name must be at least 4 characters", success: false }, { status: 400 });
        }

        // Check if store name already exists
        const [nameRows] = await pool.execute(
            `SELECT id, seller_id, status FROM stores WHERE name = ? LIMIT 1`,
            [name]
        );
        const storeNameExists = (nameRows as any[])[0];
        if (storeNameExists && (String(storeNameExists.seller_id) !== String(userId) || storeNameExists.status === "approved")) {
             return NextResponse.json({ error: "Store name already exists. Please choose a different name.", success: false }, { status: 400 });
        }

        // Check word count for description (max 100 words)
        const wordCount = description.trim().split(/\s+/).length;
        if (wordCount > 100) {
            return NextResponse.json({ error: "Description must be max 100 words", success: false }, { status: 400 });
        }

        // Upload to Cloudinary
        const logoUrl = await uploadToCloudinary(file, "stores");

        const [existingRows] = await pool.execute(
            `SELECT * FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        const existingStore = (existingRows as any[])[0];

        if (existingStore) {
            if (existingStore.status === "approved") {
                return NextResponse.json({ error: "You already have an approved store", success: false }, { status: 400 });
            }
            if (existingStore.status === "pending") {
                return NextResponse.json({ error: "Store creation approval is already pending", success: false }, { status: 400 });
            }

            // If rejected, update the existing record to allow re-submission
            // Delete old logo if it exists in Cloudinary
            if (existingStore.logo) {
                await deleteFromCloudinary(existingStore.logo);
            }

            await pool.execute(
                `UPDATE stores
                 SET name = ?, description = ?, type = ?, logo = ?, status = 'pending'
                 WHERE id = ?`,
                [name, description, type, logoUrl, existingStore.id]
            );

            // Notify Admin
            const [userRows] = await pool.execute(
                `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
                [userId]
            );
            const user = (userRows as any[])[0];
            if (user) {
                await sendAdminStoreNotificationEmail({
                    adminEmail: process.env.ADMIN_EMAIL!,
                    sellerName: user.name,
                    sellerEmail: user.email,
                    storeName: name,
                    storeDescription: description
                });
            }

            // --- In-App Notification for Admins ---
            try {
                const [admins] = await pool.execute(`SELECT id FROM users WHERE role = 'admin'`);
                const creationPromises = (admins as any[]).map(admin => 
                    pool.execute(
                        `INSERT INTO notifications (user_id, message, type, link, is_read)
                         VALUES (?, ?, 'admin', '/admin/dashboard', 0)`,
                        [
                            admin.id,
                            `New store re-submission: "${name}" from ${user?.name || 'Seller'}`,
                        ]
                    )
                );
                await Promise.all(creationPromises);
            } catch (notifError) {
                console.error("Failed to notify admins:", notifError);
            }


            const [updatedRows] = await pool.execute(`SELECT * FROM stores WHERE id = ? LIMIT 1`, [existingStore.id]);
            return NextResponse.json({ success: true, message: "Store re-submitted for approval", data: (updatedRows as any[])[0] }, { status: 200 });
        }

        const [insertResult] = await pool.execute(
            `INSERT INTO stores (seller_id, name, description, type, logo, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [userId, name, description, type, logoUrl]
        );

        // Notify Admin
        const [userRows] = await pool.execute(
            `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
            [userId]
        );
        const user = (userRows as any[])[0];
        if (user) {
            await sendAdminStoreNotificationEmail({
                adminEmail: process.env.ADMIN_EMAIL!,
                sellerName: user.name,
                sellerEmail: user.email,
                storeName: name,
                storeDescription: description
            });
        }

        // --- In-App Notification for Admins ---
        try {
            const [admins] = await pool.execute(`SELECT id FROM users WHERE role = 'admin'`);
            const creationPromises = (admins as any[]).map(admin => 
                pool.execute(
                    `INSERT INTO notifications (user_id, message, type, link, is_read)
                     VALUES (?, ?, 'admin', '/admin/dashboard', 0)`,
                    [
                        admin.id,
                        `New store approval request: "${name}" from ${user?.name || 'Seller'}`,
                    ]
                )
            );
            await Promise.all(creationPromises);
        } catch (notifError) {
            console.error("Failed to notify admins:", notifError);
        }

        const [newStoreRows] = await pool.execute(`SELECT * FROM stores WHERE id = ? LIMIT 1`, [(insertResult as any).insertId]);

        return NextResponse.json({ success: true, message: "Store submitted for approval", data: (newStoreRows as any[])[0] }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
