import pool from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/src/services/mailer";
import { sendWelcomeEmail } from "@/src/services/welcome";
// import { signupLimit, getIP } from "@/src/lib/ratelimit"; // REDIS COMMENTED OUT - UNCOMMENT IN PRODUCTION

export async function POST(request: NextRequest) {
    try {
        // Rate limiting commented out
        // REDIS COMMENTED OUT - UNCOMMENT IN PRODUCTION
        /*
        const ip = getIP(request);
        const { success } = await signupLimit.limit(`signup:${ip}`);

        if (!success) {
            return NextResponse.json({
                message: "Too many requests. Please slow down.",
                success: false
            }, { status: 429 });
        }
        */

        const { name, email, password, role } = await request.json();

        // Check if user exists
        const [existingRows] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if ((existingRows as any[]).length > 0) {
            return NextResponse.json({ message: "Email Already Exists", success: false }, { status: 400 });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Determine final role
        let finalRole = role;
        const adminEmail = process.env["Admin-Email"];
        if (adminEmail && email === adminEmail) {
            finalRole = "admin";
        }

        // Create user
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, finalRole]
        );

        const userId = (result as any).insertId;
        
        // Wrap email services in try-catch to prevent signup failure if mail server is misconfigured
        try {
            await sendEmail({
                email,
                emailType: "VERIFY",
                userId: userId.toString()
            });

            await sendWelcomeEmail({
                email,
                username: name
            });
        } catch (mailError) {
            console.error("Warning: Email notification failed:", mailError);
            // We don't throw here to allow user creation to succeed even if email fails
        }

        return NextResponse.json({
            message: "Verify your email to continue",
            success: true
        }, { status: 201 });

    } catch (error: any) {
        console.error("Signup Error:", error);
        return NextResponse.json({ message: "Internal server error", success: false }, { status: 500 });
    }
}