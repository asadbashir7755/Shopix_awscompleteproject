import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

import pool from "@/src/lib/db";
import { sendWelcomeEmail, sendLoginEmail } from "@/src/services/welcome";

export const authOptions: any = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      
    ],
    callbacks: {
        async signIn({ user, account }: any) {
            if (account?.provider === "google" || account?.provider === "github") {
                try {
                    const { name, email } = user;
                    const [existingRows] = await pool.execute(
                        `SELECT id FROM users WHERE email = ? LIMIT 1`,
                        [email]
                    );

                    let userId: number | null = null;

                    if ((existingRows as any[]).length === 0) {
                        const [insertResult] = await pool.execute(
                            `INSERT INTO users (name, email, password, is_verified, role)
                             VALUES (?, ?, ?, ?, ?)`,
                            [name, email, "", 1, "customer"]
                        );

                        userId = (insertResult as any).insertId;

                        // New user: Send welcome email
                        try {
                            await sendWelcomeEmail({
                                email: email!,
                                username: name!
                            });
                        } catch (mailError) {
                            console.error("Warning: Welcome email failed:", mailError);
                        }
                    } else {
                        userId = (existingRows as any[])[0].id;

                        // Existing user: Send login notification email
                        const loginTime = new Date().toLocaleString("en-US", { 
                            dateStyle: "full", 
                            timeStyle: "long" 
                        });
                        
                        try {
                            await sendLoginEmail({
                                email: email!,
                                username: name!,
                                loginTime,
                                deviceInfo: `Google Login (${account?.provider || "OAuth"})`
                            });
                        } catch (mailError) {
                            console.error("Warning: Login notification email failed:", mailError);
                        }
                    }

                    user.id = String(userId);
                    return true;
                } catch (error) {
                    console.error("Error in signIn callback:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user }: any) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.id = token.id;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/auth/login",
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }