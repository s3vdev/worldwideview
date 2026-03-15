"use server";

import { signIn } from "@/lib/auth";

interface LoginResult {
    success: boolean;
    error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
    try {
        await signIn("credentials", {
            email: formData.get("email") as string,
            password: formData.get("password") as string,
            redirect: false,
        });
        return { success: true };
    } catch {
        return { success: false, error: "Invalid email or password." };
    }
}
