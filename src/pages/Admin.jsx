// src/pages/Admin.jsx

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function AdminPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // formulário de criar usuário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unit, setUnit] = useState("");

  // formulário de criar KPI
  const [kpiName, setKpiName] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");
  const [unitType, setUnitType] = useState("unidades");
  const [periodicity, setPeriodicity] = useState("semanal+mensal");
  const [targetWeekly, setTargetWeekly] = useState("");
  const [targetMonthly, setTargetMonthly] = useState("");
  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [usersRes, kpisRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`, {
            credentials: "include",
          }),
          fetch(`${API_BASE_URL}/api/kpis`, {
            credentials: "include",
          }),
        ]);

        if (!usersRes.ok) {
          throw new Error("Falha ao carregar usuários");
        }
        if (!kpisRes.ok) {
          throw new Error("Falha ao carregar KPIs");
        }

        const usersData = await usersRes.json();
        const kpisData = await kpisRes.json();

        setUsers(usersData);
        setKpis(kpisData);

        // define ownerId padrão (primeiro user comum)
        const firstUser = usersData.find((u) => u.role !== "admin");
        if (firstUser) setOwnerId(String(firstUser.id));

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar dados do servidor.");
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Acesso restrito
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            Somente administradores podem acessar esta página.
          </p>
          <button
            onClick={logout}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
          >
            Voltar para login
          </button>
        </div>
      </div>
    );
  }

  // ----- helpers -----

  function getKpiCountForUser(userId) {
    return kpis.filter((k) => k.ownerId === userId).length;
  }

  // ----- criar usuário -----

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          unit: unit.trim() || "Clínica",
        }),
      });

      if (res.status === 409) {
        alert("Já existe um usuário com esse e-mail.");
        return;
      }

      if (!res.ok) {
        alert("Erro ao criar usuário.");
        return;
      }

      const created = await res.json();
      setUsers((prev) => [...prev, created]);

      // limpar form
      setName("");
      setEmail("");
      setPassword("");
      setUnit("");
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao criar usuário.");
    }
  }

  // ----- deletar usuário -----

  async function handleDeleteUser(userId) {
    const selected = users.find((u) => u.id === userId);
    if (!selected) return;

    if (selected.role === "admin") {
      alert("Não é permitido excluir o usuário admin.");
      return;
    }

    const count = getKpiCountForUser(userId);
    const confirmMsg =
      count > 0
        ? `Este usuário tem ${count} KPI(s) vinculados. Eles também serão removidos. Deseja continuar?`
        : "Tem certeza que deseja excluir este usuário?";

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        alert("Erro ao excluir usuário.");
        return;
      }

      // remove do estado
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setKpis((prev) => prev.filter((k) => k.ownerId !== userId));
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao excluir usuário.");
    }
  }

  // ----- criar KPI -----

  async function handleCreateKpi(e) {
    e.preventDefault();
    if (!kpiName.trim() || !ownerId) return;

    const body = {
      name: kpiName.trim(),
      description: kpiDescription.trim(),
      unitType,
      periodicity,
      targetWeekly:
        periodicity === "semanal" || periodicity === "semanal+mensal"
          ? Number(targetWeekly || 0)
          : undefined,
      targetMonthly:
        periodicity === "mensal" || periodicity === "semanal+mensal"
          ? Number(targetMonthly || 0)
          : undefined,
      ownerId: Number(ownerId),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/kpis`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        alert("Erro ao criar KPI.");
        return;
      }

      const created = await res.json();
      setKpis((prev) => [...prev, created]);

      // limpar form
      setKpiName("");
      setKpiDescription("");
      setUnitType("unidades");
      setPeriodicity("semanal+mensal");
      setTargetWeekly("");
      setTargetMonthly("");
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao criar KPI.");
    }
  }

  // ----- UI -----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 text-sm text-slate-700">
          Carregando dados do admin...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Goal Tracker – Admin
            </h1>
            <p className="text-xs text-slate-500">
              Logado como: {user.name} ({user.email})
            </p>
          </div>
          <button
            onClick={logout}
            className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* CADASTRO DE USUÁRIOS */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Cadastro de usuários
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Form novo usuário */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                Novo usuário
              </h3>
              <form className="space-y-3 text-sm" onSubmit={handleCreateUser}>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Ex.: Márcia, Michelle..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="responsavel@clinica.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Senha inicial
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Senha inicial"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Unidade / área
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Adm Técnica, Recepção..."
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
                >
                  Criar usuário
                </button>
              </form>
            </div>

            {/* Lista de usuários + KPIs vinculados */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                Usuários cadastrados
              </h3>
              {users.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum usuário cadastrado ainda.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {users.map((u) => {
                    const count = getKpiCountForUser(u.id);
                    return (
                      <li
                        key={u.id}
                        className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {u.name}{" "}
                            {u.role === "admin" && (
                              <span className="text-[10px] ml-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.email} • {u.unit || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {count === 0
                              ? "Nenhum KPI vinculado"
                              : `${count} KPI(s) vinculados`}
                          </div>
                        </div>
                        {u.role !== "admin" && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Excluir
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* CADASTRO DE KPIs (resumido, só pra manter fluxo de admin) */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Cadastro de KPIs
          </h2>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <form
              className="space-y-3 text-sm"
              onSubmit={handleCreateKpi}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome do KPI
                  </label>
                  <input
                    type="text"
                    value={kpiName}
                    onChange={(e) => setKpiName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Ex.: Vídeos nas redes sociais"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={kpiDescription}
                    onChange={(e) => setKpiDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Detalhe como a meta deve ser cumprida."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Tipo de unidade
                  </label>
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="unidades">Unidades</option>
                    <option value="percentual">Percentual (%)</option>
                    <option value="valor">Valor (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Periodicidade
                  </label>
                  <select
                    value={periodicity}
                    onChange={(e) => setPeriodicity(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="semanal+mensal">Semanal + Mensal</option>
                  </select>
                </div>

                {(periodicity === "semanal" ||
                  periodicity === "semanal+mensal") && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Meta semanal
                    </label>
                    <input
                      type="number"
                      value={targetWeekly}
                      onChange={(e) => setTargetWeekly(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      placeholder="Ex.: 2"
                    />
                  </div>
                )}

                {(periodicity === "mensal" ||
                  periodicity === "semanal+mensal") && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Meta mensal
                    </label>
                    <input
                      type="number"
                      value={targetMonthly}
                      onChange={(e) => setTargetMonthly(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      placeholder="Ex.: 8"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Responsável
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Selecione</option>
                    {users
                      .filter((u) => u.role !== "admin")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.unit || "—"})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
              >
                Criar KPI
              </button>
            </form>

            {kpis.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  KPIs cadastrados ({kpis.length})
                </h3>
                <ul className="space-y-1 text-xs text-slate-600">
                  {kpis.map((k) => {
                    const owner = users.find((u) => u.id === k.ownerId);
                    return (
                      <li
                        key={k.id}
                        className="flex justify-between border border-slate-200 rounded-md px-2 py-1.5"
                      >
                        <div>
                          <div className="font-medium text-slate-800">
                            {k.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Resp.: {owner ? owner.name : "—"} •{" "}
                            {k.periodicity} • {k.unitType}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
