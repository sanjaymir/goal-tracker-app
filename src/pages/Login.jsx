// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const { login, user, error: authError, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    const result = await login(email, password);
    if (!result.success) {
      setLocalError(result.error || "Erro ao fazer login.");
    }
  };

  const finalError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">GoalTracker</h1>
          <p className="text-slate-600 mt-2">
            Faça login para acessar suas metas
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />

            {finalError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {finalError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
            <p>Credenciais de Teste (no banco atual):</p>
            <div className="mt-2 space-y-1">
              <p>
                <span className="font-medium">Admin:</span>{" "}
                sanjaymir@icloud.com / Bhagwanmir92
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
