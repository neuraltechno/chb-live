"use client";

import { create } from "zustand";
import { Game, SportType, Message } from "@/types";

// ---------- Game Store ----------
interface GameStore {
  selectedSport: SportType | "all";
  selectedLeagues: string[];
  selectedRound: number | null;
  selectedGame: Game | null;
  teamSearch: string;
  setSport: (sport: SportType | "all") => void;
  toggleLeague: (leagueId: string) => void;
  setRound: (round: number | null) => void;
  clearSelectedLeagues: () => void;
  setSelectedGame: (game: Game | null) => void;
  setTeamSearch: (query: string) => void;
  clearFilters: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  selectedSport: "all",
  selectedLeagues: [],
  selectedRound: null,
  selectedGame: null,
  teamSearch: "",
  setSport: (sport) =>
    set({ selectedSport: sport, selectedLeagues: [], selectedRound: null }),
  toggleLeague: (leagueId) =>
    set((state) => ({
      selectedLeagues: state.selectedLeagues.includes(leagueId)
        ? state.selectedLeagues.filter((id) => id !== leagueId)
        : [...state.selectedLeagues, leagueId],
    })),
  setRound: (round) => set({ selectedRound: round }),
  clearSelectedLeagues: () => set({ selectedLeagues: [] }),
  setSelectedGame: (game) => set({ selectedGame: game }),
  setTeamSearch: (query) => set({ teamSearch: query }),
  clearFilters: () => set({ selectedSport: "all", selectedLeagues: [], teamSearch: "" }),
}));

// ---------- Chat Store ----------
interface ChatStore {
  messages: Message[];
  activeUsers: number;
  typingUsers: string[];
  isLoadingMessages: boolean;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setActiveUsers: (count: number) => void;
  addTypingUser: (username: string) => void;
  removeTypingUser: (username: string) => void;
  setLoadingMessages: (loading: boolean) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  activeUsers: 0,
  typingUsers: [],
  isLoadingMessages: false,
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setMessages: (messages) => set({ messages }),
  setActiveUsers: (count) => set({ activeUsers: count }),
  addTypingUser: (username) =>
    set((state) => ({
      typingUsers: state.typingUsers.includes(username)
        ? state.typingUsers
        : [...state.typingUsers, username],
    })),
  removeTypingUser: (username) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u !== username),
    })),
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  clearChat: () =>
    set({ messages: [], activeUsers: 0, typingUsers: [] }),
}));

// ---------- DM Store ----------
interface DMStore {
  isDMOpen: boolean;
  targetDMUserId: string | null; // userId to open a specific conversation with
  totalUnread: number;
  openDM: (targetUserId?: string) => void;
  closeDM: () => void;
  clearTargetDMUser: () => void;
  setTotalUnread: (count: number) => void;
}

export const useDMStore = create<DMStore>((set) => ({
  isDMOpen: false,
  targetDMUserId: null,
  totalUnread: 0,
  openDM: (targetUserId?: string) =>
    set({ isDMOpen: true, targetDMUserId: targetUserId || null }),
  closeDM: () => set({ isDMOpen: false, targetDMUserId: null }),
  clearTargetDMUser: () => set({ targetDMUserId: null }),
  setTotalUnread: (count: number) => set({ totalUnread: count }),
}));
