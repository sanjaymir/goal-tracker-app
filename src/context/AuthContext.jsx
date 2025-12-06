/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.MODE === "production"
    ? window.location.origin
    : "http://localhost:3000");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // carrega usuário ativo via cookie e tenta refresh em erro 401
  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
          return;
        }
        if (res.status === 401) {
          const refreshRes = await fetch(`${API_BASE_URL}/api/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data.user) setUser(data.user);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar sessão:", e);
      }
    }
    fetchMe();
  }, []);

  // -------- LOGIN (bate no backend /api/login) --------
  const login = async (email, password) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: String(email || "").trim(),
          password: password || "",
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          const msg =
            data?.error || "E-mail ou senha inválidos.";
          setError(msg);
          setLoading(false);
          return { success: false, error: msg };
        }

        setError("Erro ao conectar com o servidor.");
        setLoading(false);
        return { success: false, error: "Erro ao conectar com o servidor." };
      }

      const data = await res.json();
      // data = { user: {...} }

      setUser(data.user);
      setLoading(false);

      return { success: true };
    } catch (err) {
      console.error("Erro no login:", err);
      const msg = "Erro ao conectar com o servidor.";
      setError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  };

  // -------- LOGOUT --------
  const logout = () => {
    fetch(`${API_BASE_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    }).catch((e) => console.error("Erro ao sair:", e));

    setUser(null);
    setError("");
  };

  // -------- FETCH autenticado de conveniência --------
  const authFetch = async (path, options = {}) => {
    if (!user) {
      throw new Error("Sem usuário autenticado.");
    }

    const res = await fetch(
      path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
      { ...options, credentials: "include" }
    );

    if (res.status === 401) {
      const refreshRes = await fetch(`${API_BASE_URL}/api/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.user) setUser(data.user);
        // tenta novamente a requisição original
        return fetch(
          path.startsWith("http") ? path : `${API_BASE_URL}${path}`,
          { ...options, credentials: "include" }
        );
      } else {
        setUser(null);
        throw new Error("Sessão expirada. Faça login novamente.");
      }
    }

    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
