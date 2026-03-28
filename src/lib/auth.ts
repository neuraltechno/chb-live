import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import dbConnect from "./db";
import { UserModel } from "./models";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        username: { label: "Username", type: "text" },
        mode: { label: "Mode", type: "text" }, // "login" | "register"
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await dbConnect();

        const isRegister = credentials.mode === "register";

        if (isRegister) {
          // ---------- REGISTER ----------
          if (!credentials.username || credentials.username.length < 3) {
            throw new Error("Username must be at least 3 characters");
          }

          const existingUser = await UserModel.findOne({
            $or: [
              { email: credentials.email },
              { username: credentials.username },
            ],
          });

          if (existingUser) {
            if (existingUser.email === credentials.email) {
              throw new Error("An account with this email already exists");
            }
            throw new Error("This username is already taken");
          }

          const hashedPassword = await bcrypt.hash(credentials.password, 12);

          const newUser = await UserModel.create({
            username: credentials.username,
            email: credentials.email,
            password: hashedPassword,
            provider: "credentials",
            avatar: `https://api.dicebear.com/8.x/initials/svg?seed=${credentials.username}&backgroundColor=6366f1`,
          });

          return {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.username,
            image: newUser.avatar,
          };
        } else {
          // ---------- LOGIN ----------
          const user = await UserModel.findOne({ email: credentials.email }).select("+password");

          if (!user || !user.password) {
            throw new Error("Invalid email or password");
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error("Invalid email or password");
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.username,
            image: user.avatar,
          };
        }
      },
    }),
    // Google OAuth — only enabled if env vars are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const next = new URL(url);
        const base = new URL(baseUrl);
        if (next.origin === base.origin) return url;
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await dbConnect();

        const existingUser = await UserModel.findOne({ email: user.email });

        if (!existingUser) {
          const username =
            user.name?.replace(/\s+/g, "").toLowerCase().slice(0, 15) ||
            `user${Date.now()}`;

          await UserModel.create({
            username,
            email: user.email,
            avatar: user.image,
            provider: "google",
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        await dbConnect();
        const dbUser = await UserModel.findOne({ email: user.email });
        if (dbUser) {
          token.userId = dbUser._id.toString();
          token.username = dbUser.username;
          token.avatar = dbUser.avatar;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).username = token.username;
        (session.user as any).avatar = token.avatar;
      }
      return session;
    },
  },
};
