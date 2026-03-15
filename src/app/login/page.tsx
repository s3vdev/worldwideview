"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import styles from "../setup/setup.module.css";

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await loginAction(formData);

        if (result.success) {
            router.push("/");
            router.refresh();
        } else {
            setError(result.error ?? "Login failed.");
            setLoading(false);
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>W</div>
                <h1 className={styles.title}>Sign in to WorldWideView</h1>
                <p className={styles.subtitle}>Enter your credentials to continue</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <label className={styles.label} htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className={styles.input}
                        placeholder="admin@example.com"
                    />

                    <label className={styles.label} htmlFor="password">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className={styles.input}
                    />

                    {error && <p className={styles.error}>{error}</p>}

                    <button type="submit" disabled={loading} className={styles.button}>
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
