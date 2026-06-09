import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Dumbbell,
  LogOut,
  Calendar,
  MessageSquare,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "../components/Button";

// Dados mockados para demonstração
const mockAppointments = [
  {
    id: 1,
    client: "Carlos Souza",
    phone: "(11) 98765-4321",
    plan: "Semi-Presencial",
    date: "2026-05-05",
    time: "14:00",
    status: "pending"
  },
  {
    id: 2,
    client: "Mariana Alves",
    phone: "(11) 91234-5678",
    plan: "Consultoria Online",
    date: "2026-05-05",
    time: "16:00",
    status: "confirmed"
  },
  {
    id: 3,
    client: "Ricardo Dias",
    phone: "(11) 99876-5432",
    plan: "Personal VIP",
    date: "2026-05-06",
    time: "09:00",
    status: "pending"
  },
  {
    id: 4,
    client: "Ana Paula",
    phone: "(11) 97654-3210",
    plan: "Semi-Presencial",
    date: "2026-05-06",
    time: "15:30",
    status: "confirmed"
  }
];

const mockConversations = [
  {
    id: 1,
    client: "João Silva",
    phone: "(11) 94567-8901",
    lastMessage: "Oi João! Gostaria de saber mais sobre o plano Semi-Presencial. Vocês têm horários de manhã?",
    timestamp: "2026-05-04 17:45",
    unread: true
  },
  {
    id: 2,
    client: "Fernanda Costa",
    phone: "(11) 93456-7890",
    lastMessage: "Obrigada pelas informações! Vou pensar e te retorno amanhã.",
    timestamp: "2026-05-04 16:20",
    unread: true
  },
  {
    id: 3,
    client: "Bruno Martins",
    phone: "(11) 92345-6789",
    lastMessage: "Perfeito! Vou fazer a transferência agora e te mando o comprovante.",
    timestamp: "2026-05-04 14:10",
    unread: false
  }
];

export function Admin() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState(mockAppointments);
  const [conversations, setConversations] = useState(mockConversations);

  useEffect(() => {
    // Verificar autenticação
    const isAuthenticated = localStorage.getItem("admin_authenticated");
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("admin_authenticated");
    navigate("/login");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const pendingAppointments = appointments.filter(a => a.status === "pending").length;
  const unreadMessages = conversations.filter(c => c.unread).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="text-lime-400" size={24} />
            <div>
              <h1 className="font-black text-lg tracking-tighter uppercase italic">Painel Admin</h1>
              <p className="text-xs text-zinc-500">Bem-vindo, João Marcos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ExternalLink size={16} />
                Ver site
              </Button>
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-lime-400 transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="text-lime-400" size={24} />
              <span className="text-xs font-bold text-zinc-500 uppercase">Agendamentos</span>
            </div>
            <p className="text-3xl font-black">{appointments.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Total próximos dias</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="text-orange-400" size={24} />
              <span className="text-xs font-bold text-zinc-500 uppercase">Pendentes</span>
            </div>
            <p className="text-3xl font-black">{pendingAppointments}</p>
            <p className="text-xs text-zinc-500 mt-1">Aguardando confirmação</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="text-blue-400" size={24} />
              <span className="text-xs font-bold text-zinc-500 uppercase">Mensagens</span>
            </div>
            <p className="text-3xl font-black">{unreadMessages}</p>
            <p className="text-xs text-zinc-500 mt-1">Não lidas</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Agendamentos */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-lime-400" size={20} />
              <h2 className="text-xl font-black uppercase italic">Agendamentos</h2>
            </div>

            <div className="space-y-3">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-lime-400/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                        <User className="text-zinc-500" size={18} />
                      </div>
                      <div>
                        <p className="font-bold">{apt.client}</p>
                        <p className="text-xs text-zinc-500">{apt.plan}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        apt.status === "confirmed"
                          ? "bg-lime-400/10 text-lime-400"
                          : "bg-orange-400/10 text-orange-400"
                      }`}
                    >
                      {apt.status === "confirmed" ? "Confirmado" : "Pendente"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>{formatDate(apt.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span>{apt.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} />
                      <span>{apt.phone}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-2">
                    <a
                      href={`https://wa.me/55${apt.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Contatar
                      </Button>
                    </a>
                    {apt.status === "pending" && (
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setAppointments(prev =>
                            prev.map(a => a.id === apt.id ? { ...a, status: "confirmed" } : a)
                          );
                        }}
                      >
                        Confirmar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversas */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="text-lime-400" size={20} />
              <h2 className="text-xl font-black uppercase italic">Conversas</h2>
            </div>

            <div className="space-y-3">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`bg-zinc-900 border rounded-2xl p-4 hover:border-lime-400/50 transition-colors ${
                    conv.unread ? "border-lime-400/30" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                        <User className="text-zinc-500" size={18} />
                      </div>
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          {conv.client}
                          {conv.unread && (
                            <span className="w-2 h-2 bg-lime-400 rounded-full"></span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">{conv.phone}</p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-600">{conv.timestamp.split(" ")[1]}</span>
                  </div>

                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{conv.lastMessage}</p>

                  <a
                    href={`https://wa.me/55${conv.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Responder no WhatsApp
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
