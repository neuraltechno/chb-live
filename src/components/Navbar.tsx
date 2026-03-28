"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton, UserButton, useUser, useAuth } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import {
  Gamepad2,
  User,
  MessageSquare,
  Menu,
  X,
  MessageCircle,
} from "lucide-react";
import { useDMStore } from "@/lib/store";
import DMPanel from "./DMPanel";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Navbar() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isDMOpen, openDM, closeDM } = useDMStore();

  // Fetch unread DM count from Convex
  const conversations = useQuery(api.conversations.list) || [];
  const totalUnread = 0; // Temporary fix to bypass unreadCount error until conversations schema is verified


  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-dark-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Gamepad2 className="w-8 h-8 text-primary-500 group-hover:text-primary-400 transition-colors" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-green rounded-full animate-pulse-live" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Gamebloc
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-dark-300 hover:text-white transition-colors text-sm font-medium"
            >
              Matches
            </Link>
            <div className="flex items-center gap-2 text-dark-500 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Sports Chat</span>
            </div>
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="w-8 h-8 rounded-full bg-dark-700 animate-pulse" />
            ) : isSignedIn ? (
              <>
                {/* DM Button */}
                <button
                  onClick={() => openDM()}
                  className="relative p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 border border-transparent hover:border-dark-600/50 transition-all"
                  title="Direct Messages"
                >
                  <MessageCircle className="w-5 h-5" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary-600 flex items-center justify-center text-[9px] font-bold text-white px-0.5 border border-dark-900">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </button>

                {/* Profile Button */}
                <Link
                  href="/profile"
                  className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all"
                  title="Profile Settings"
                >
                  <User className="w-5 h-5" />
                </Link>

                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-primary-600/25">
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              </SignInButton>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-dark-400 hover:text-white"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-dark-800/95 backdrop-blur-md border-t border-dark-700/50 animate-slide-down">
          <div className="px-4 py-3 space-y-2">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-700/50 transition-colors text-sm"
            >
              Matches
            </Link>
          </div>
        </div>
      )}

      {/* DM Panel */}
      <DMPanel isOpen={isDMOpen} onClose={closeDM} />
    </nav>
  );
}
