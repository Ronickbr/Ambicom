"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (userId: string) => {
        logger.debug(`Fetching profile for user: ${userId}`);
        const start = performance.now();

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Profile fetch timeout")), 30000)
        );

        try {
            // Race between the query and the timeout
            const result = await Promise.race([
                supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .single(),
                timeoutPromise.then(() => ({ data: null, error: { message: "Timeout" } } as any))
            ]) as { data: any, error: any };

            const { data, error } = result;

            const duration = performance.now() - start;
            logger.debug(`Profile fetch completed in ${duration.toFixed(2)}ms`);

            if (error) {
                logger.error("Error fetching profile:", error);
                return null;
            }
            if (data) {
                logger.info("Profile loaded successfully", { role: data.role });
                setProfile(data as Profile);
                return data as Profile;
            }
        } catch (err) {
            logger.error("Unexpected error fetching profile:", err);
        }
        return null;
    }, []);

    // 1. Get initial session
    const initAuth = useCallback(async () => {
        logger.info("Initializing Auth...");
        const start = performance.now();

        // Safety timeout to prevent infinite loading
        const safetyTimeout = setTimeout(() => {
            if (loading) {
                logger.warn("Auth initialization timed out after 15s. Forcing loading to false.");
                setLoading(false);
            }
        }, 15000);

        try {
            logger.debug("Calling supabase.auth.getSession()...");
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                logger.error("Supabase getSession error:", error);
                throw error;
            }

            if (session?.user) {
                logger.info("Session found", { userId: session.user.id });
                setUser(session.user);
                await fetchProfile(session.user.id);
            } else {
                logger.info("No active session found");
                setUser(null);
                setProfile(null);
            }
        } catch (err) {
            logger.error("Auth initialization error:", err);
            setUser(null);
            setProfile(null);
        } finally {
            clearTimeout(safetyTimeout);
            const duration = performance.now() - start;
            logger.info(`Auth initialization completed in ${duration.toFixed(2)}ms`);
            setLoading(false);
        }
    }, [fetchProfile]);

    useEffect(() => {
        let mounted = true;
        logger.debug("AuthProvider mounted");

        initAuth();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            logger.info(`Auth state changed: ${event}`, { sessionUser: session?.user?.id });

            // Avoid redundant fetching if initAuth already handled it
            if (event === 'INITIAL_SESSION') return;

            try {
                if (session?.user) {
                    setUser(session.user);
                    // Fetch profile to ensure sync
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } catch (err) {
                logger.error("Auth change error:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        });

        return () => {
            logger.debug("AuthProvider unmounting");
            mounted = false;
            subscription.unsubscribe();
        };
    }, [initAuth, fetchProfile]);

    const signOut = async () => {
        logger.info("Signing out...");
        try {
            toast.loading("Saindo do sistema...", { id: "signout" });
            await supabase.auth.signOut();
            logger.info("Sign out successful");
            toast.success("Até logo!", { id: "signout" });
            window.location.href = "/login";
        } catch (error) {
            logger.error("Logout error:", error);
            toast.error("Erro ao sair", { id: "signout" });
        }
    };

    const value = useMemo(() => ({
        user,
        profile,
        loading,
        signOut
    }), [user, profile, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
