import { motion } from "motion/react";
import { 
  Dumbbell, 
  CheckCircle2, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Target,
  ClipboardList,
  CalendarClock,
  HeartPulse,
  RefreshCw,
  X,
  Check,
  Flame,
  Brain,
  Activity
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Button } from "../components/Button";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Header = () => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Dumbbell className="text-lime-400" size={24} />
        <span className="font-black text-xl tracking-tighter uppercase italic">João Marcos</span>
      </div>
      <a href="#contato">
        <Button size="sm">Agendar agora</Button>
      </a>
    </div>
  </header>
);

const Hero = () => (
  <section className="relative pt-24 pb-12 lg:pt-40 lg:pb-32 overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-block px-3 py-1 bg-lime-400/10 text-lime-400 rounded-full text-sm font-bold mb-4 uppercase tracking-wider">
          Personal Trainer & Coach
        </span>
        <h1 className="text-5xl lg:text-7xl font-black mb-6 leading-[1.1] tracking-tight">
          TRANSFORME SEU <br />
          <span className="text-lime-400 italic">CORPO E MENTE.</span>
        </h1>
        <p className="text-zinc-400 text-lg lg:text-xl mb-8 max-w-lg leading-relaxed">
          Treinos personalizados para quem busca performance, estética e saúde. Alcance o próximo nível com acompanhamento profissional de verdade.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="#planos" className="flex-1">
            <Button size="lg" className="shadow-[0_0_20px_rgba(163,230,53,0.3)]">
              Começar minha jornada
            </Button>
          </a>
          <a href="#contato" className="flex-1 sm:flex-none">
            <Button variant="outline" size="lg">
              Falar no WhatsApp
            </Button>
          </a>
        </div>
        <div className="mt-8 flex items-center gap-2 text-lime-400 text-sm font-bold">
          <Clock size={16} />
          <p>Vagas limitadas</p>
        </div>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
          <img
            src="/src/imports/WhatsApp_Image_2026-05-04_at_18.09.27.jpeg"
            alt="João Marcos Treinando"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent" />
        </div>
        <div className="absolute -bottom-6 -right-6 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-xl hidden sm:block">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center">
              <TrendingUp size={24} className="text-black" />
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase font-bold">Progresso</p>
              <p className="font-bold text-lg leading-none">+45% Força</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

const Benefits = () => {
  const items = [
    { 
      title: "Planejamento Único", 
      desc: "Nada de planilhas prontas. Cada exercício é escolhido para o seu objetivo.", 
      icon: <Zap className="text-lime-400" /> 
    },
    { 
      title: "Suporte VIP", 
      desc: "Dúvidas resolvidas diretamente pelo WhatsApp. Resposta em poucas horas.", 
      icon: <MessageCircle className="text-lime-400" /> 
    },
    { 
      title: "Resultados Reais", 
      desc: "Foco em progressão de carga e técnica impecável para evitar lesões.", 
      icon: <CheckCircle2 className="text-lime-400" /> 
    },
    { 
      title: "Flexibilidade", 
      desc: "Treine onde quiser: em casa, no parque ou na academia do seu prédio.", 
      icon: <Clock className="text-lime-400" /> 
    },
  ];

  return (
    <section className="py-20 bg-zinc-900/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-lime-400/50 transition-colors"
            >
              <div className="mb-4">{item.icon}</div>
              <h3 className="font-bold text-xl mb-2">{item.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Plans = () => {
  const plans = [
    {
      name: "Consultoria Online",
      price: "80",
      period: "/mês",
      desc: "Para quem quer autonomia mas precisa de um guia especializado.",
      features: ["Planilha via App", "Acompanhamento por texto", "Ajustes quinzenais", "Vídeos de execução"],
      cta: "Começar Online",
      popular: false
    },
    {
      name: "Semi-Presencial",
      price: "170",
      period: "/mês",
      desc: "O equilíbrio perfeito: 4 treinos presenciais por mês + consultoria online.",
      features: ["4 aulas presenciais/mês", "Planilha via App full", "Suporte prioritário", "Avaliação física 1x/mês"],
      cta: "Agendar Híbrido",
      popular: true
    },
    {
      name: "Personal VIP",
      price: "450",
      period: "/mês",
      desc: "Atenção total. Treinos 100% acompanhados para máxima performance.",
      features: ["Até 5x por semana", "Correção técnica em tempo real", "Monitoramento de carga", "Correção postural e biomecânica"],
      cta: "Consultar Horários",
      popular: false
    }
  ];

  return (
    <section id="planos" className="py-24 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-black mb-4 uppercase italic">Escolha o seu nível</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">Temos o modelo ideal para o seu ritmo de vida e disponibilidade financeira.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div 
              key={idx} 
              className={cn(
                "relative p-8 rounded-3xl flex flex-col border transition-all duration-300 hover:bg-zinc-900 hover:border-lime-400 hover:shadow-[0_0_30px_rgba(163,230,53,0.1)]",
                plan.popular ? "bg-zinc-900 border-lime-400 shadow-[0_0_30px_rgba(163,230,53,0.1)]" : "bg-zinc-950 border-zinc-800"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-lime-400 text-black text-[10px] font-black uppercase px-4 py-1 rounded-full">
                  Mais procurado
                </div>
              )}
              <h3 className="text-2xl font-black mb-2 uppercase italic">{plan.name}</h3>
              <p className="text-zinc-400 text-sm mb-6 h-10">{plan.desc}</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-zinc-500 text-lg font-bold">R$</span>
                <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                <span className="text-zinc-500 text-sm font-medium">{plan.period}</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 size={16} className="text-lime-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href={`https://wa.me/558592718614?text=Olá João! Tenho interesse no plano ${plan.name}`} target="_blank" rel="noopener noreferrer">
                <Button variant={plan.popular ? "primary" : "outline"} className="w-full">
                  {plan.cta}
                </Button>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Steps = () => (
  <section className="py-24 bg-zinc-900/30 border-y border-zinc-900">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-black uppercase italic italic">Como funciona?</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-12 relative">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800 -translate-y-1/2 hidden md:block z-0" />
        
        {[
          { step: "01", title: "Escolha seu Plano", desc: "Selecione o modelo que melhor se adapta à sua rotina." },
          { step: "02", title: "Entrevista Inicial", desc: "Faremos uma anamnese completa para entender seus limites e metas." },
          { step: "03", title: "Início Imediato", desc: "Receba seu treino e comece a treinar com acompanhamento." }
        ].map((item, idx) => (
          <div key={idx} className="relative z-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-950 border-4 border-zinc-900 rounded-full flex items-center justify-center mb-6 text-lime-400 font-black text-xl italic">
              {item.step}
            </div>
            <h4 className="font-bold text-lg mb-2">{item.title}</h4>
            <p className="text-zinc-400 text-sm max-w-[200px]">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const AuthorityMetrics = () => {
  const pillars = [
    { 
      title: "Biomecânica Aplicada", 
      desc: "Análise milimétrica da sua execução para garantir que o músculo alvo seja atingido com segurança total.",
      icon: <Target className="text-lime-400" size={32} />
    },
    { 
      title: "Carga Progressiva", 
      desc: "Metodologia baseada em dados: cada treino é um degrau planejado para superar seu limite anterior.",
      icon: <TrendingUp className="text-lime-400" size={32} />
    },
    { 
      title: "Neurociência do Hábito", 
      desc: "Estratégias mentais para manter a constância mesmo naqueles dias em que a motivação desaparece.",
      icon: <Zap className="text-lime-400" size={32} />
    }
  ];

  return (
    <section className="py-24 bg-zinc-950 overflow-hidden border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-black mb-4 uppercase italic">A Ciência do <span className="text-lime-400">Resultado.</span></h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">Não é sorte, é método. Cada treino é desenhado sobre três pilares que transformam esforço em resultado mensurável.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {pillars.map((p, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-lime-400/30 transition-all group"
            >
              <div className="mb-6">{p.icon}</div>
              <h3 className="text-xl font-bold mb-3">{p.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="pt-16 border-t border-zinc-900">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-lime-400/10 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
              Compromisso assinado
            </span>
            <h3 className="text-2xl lg:text-4xl font-black uppercase italic">
              O que você <span className="text-lime-400">recebe na semana 1.</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <ClipboardList size={22} />, title: "Avaliação 360°", desc: "Anamnese completa: histórico, lesões, rotina e metas mapeadas em até 24h." },
              { icon: <CalendarClock size={22} />, title: "Plano em 48h", desc: "Protocolo de treino e estratégia nutricional entregues em até dois dias úteis." },
              { icon: <HeartPulse size={22} />, title: "Suporte direto", desc: "Acesso ao meu WhatsApp pessoal para dúvidas técnicas durante toda a jornada." },
              { icon: <RefreshCw size={22} />, title: "Ajuste a cada 30 dias", desc: "Reavaliação mensal obrigatória. Se algo não evoluir, o plano muda na hora." }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-zinc-800 hover:border-lime-400/40 transition-all group overflow-hidden"
              >
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-lime-400/5 rounded-full blur-2xl group-hover:bg-lime-400/10 transition-colors" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-lime-400/10 text-lime-400 flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-lime-400/70 mb-1">0{i + 1}</p>
                  <h4 className="font-bold mb-2">{item.title}</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const MythsVsTruths = () => {
  const rows = [
    { myth: "Treinar 2h por dia acelera o resultado.", truth: "60 min bem estruturados rendem mais que 2h sem direção." },
    { myth: "Sem dieta restritiva, não há evolução.", truth: "Estratégia nutricional sustentável vence qualquer dieta-relâmpago." },
    { myth: "Mais peso na barra = mais músculo.", truth: "Execução correta com carga adequada é o que recruta fibra muscular." },
    { myth: "Suplemento é o atalho do resultado.", truth: "Sono, treino e constância respondem por 90% da sua evolução." },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(163,230,53,0.06),transparent_50%)] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 relative z-10">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1 bg-lime-400/10 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
            Verdade que ninguém te conta
          </span>
          <h2 className="text-3xl lg:text-5xl font-black uppercase italic">
            Mitos <span className="text-zinc-600">x</span> <span className="text-lime-400">Verdades.</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mt-4">
            A indústria fitness lucra com a sua confusão. O método existe para te tirar dela.
          </p>
        </div>

        <div className="space-y-4">
          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-2 gap-px bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-800"
            >
              <div className="p-6 bg-zinc-950 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <X size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-red-500/80 mb-1">Mito</p>
                  <p className="text-zinc-400 line-through decoration-red-500/40">{row.myth}</p>
                </div>
              </div>
              <div className="p-6 bg-zinc-900/40 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-lime-400/10 flex items-center justify-center shrink-0">
                  <Check size={16} className="text-lime-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-lime-400 mb-1">Verdade</p>
                  <p className="text-white">{row.truth}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PhilosophyStrip = () => {
  const words = [
    { icon: <Flame size={18} />, text: "Disciplina" },
    { icon: <Brain size={18} />, text: "Estratégia" },
    { icon: <Activity size={18} />, text: "Consistência" },
    { icon: <Target size={18} />, text: "Resultado" },
    { icon: <Flame size={18} />, text: "Disciplina" },
    { icon: <Brain size={18} />, text: "Estratégia" },
    { icon: <Activity size={18} />, text: "Consistência" },
    { icon: <Target size={18} />, text: "Resultado" },
  ];
  return (
    <section className="py-6 bg-lime-400 text-black overflow-hidden border-y border-lime-300">
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
      >
        {[...words, ...words].map((w, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0">
            {w.icon}
            <span className="font-black uppercase italic tracking-tight text-xl">{w.text}</span>
            <span className="text-black/40">/</span>
          </div>
        ))}
      </motion.div>
    </section>
  );
};


const CTAFinal = () => (
  <section id="contato" className="py-24 relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-lime-400/10 blur-[120px] rounded-full pointer-events-none" />
    
    <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
      <h2 className="text-4xl lg:text-6xl font-black mb-6 uppercase tracking-tight italic">
        PRONTO PARA SUA <br />
        <span className="text-lime-400 italic">MELHOR VERSÃO?</span>
      </h2>
      <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
        As vagas são limitadas para garantir a qualidade do acompanhamento. Não deixe para amanhã o treino que pode mudar sua vida hoje.
      </p>
      <a href="https://wa.me/558592718614?text=Olá João! Quero agendar meu treino." target="_blank" rel="noopener noreferrer" className="inline-block w-full sm:w-auto">
        <Button size="lg" className="px-12 flex items-center gap-2 group">
          <MessageCircle size={20} />
          <span>Falar com João no WhatsApp</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </Button>
      </a>
      <div className="mt-8 flex flex-wrap justify-center gap-6 text-zinc-500 text-xs font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-lime-400" />
          Satisfação Garantida
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-lime-400" />
          Acesso Imediato
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-12 border-t border-zinc-900 bg-zinc-950">
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
      <div className="flex items-center gap-2 opacity-50">
        <Dumbbell size={20} />
        <span className="font-black tracking-tighter uppercase italic">João Marcos</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-zinc-600 text-sm">
          © 2026 João Marcos Personal. Todos os direitos reservados.
        </p>
        <a href="/login" className="text-zinc-800 hover:text-zinc-600 text-[10px] transition-colors">
          Admin
        </a>
      </div>
      <div className="flex gap-4">
        <a href="https://www.instagram.com/prof_jmbatista/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-lime-400 transition-colors cursor-pointer">
          <span className="font-bold text-[10px]">IG</span>
        </a>
      </div>
    </div>
  </footer>
);

export function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-lime-400 selection:text-black">
      <Header />
      <Hero />
      <Benefits />
      <Steps />
      <Plans />
      <AuthorityMetrics />
      <PhilosophyStrip />
      <MythsVsTruths />
      <CTAFinal />
      <Footer />
      
      <a 
        href="https://wa.me/558592718614?text=Olá João Marcos, vi sua página e gostaria de receber mais informações sobre os planos disponíveis." 
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 sm:hidden"
      >
        <MessageCircle size={24} fill="currentColor" />
      </a>
    </div>
  );
}