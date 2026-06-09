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
  Star
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Button } from "../components/Button";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

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
        <div className="mt-8 flex items-center gap-4 text-zinc-500 text-sm">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center overflow-hidden">
                <ImageWithFallback 
                  src={`https://i.pravatar.cc/100?u=${i}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <p>+200 alunos transformados em 2025</p>
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
        {/* Floating cards for "conversion triggers" */}
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
      features: ["Até 5x por semana", "Correção técnica em tempo real", "Monitoramento de carga", "Suporte nutricional base"],
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
                "relative p-8 rounded-3xl flex flex-col border",
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
              <a href={`https://wa.me/550000000000?text=Olá João! Tenho interesse no plano ${plan.name}`}>
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
        {/* Connection line (hidden on mobile) */}
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

const SocialProof = () => {
  const testimonials = [
    { name: "Carlos Souza", role: "Aluno há 6 meses", text: "Perdi 12kg e minha postura melhorou absurdamente. O João é muito criterioso.", img: "https://images.unsplash.com/photo-1734191321941-08c5ff82c3ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXQlMjBtYW4lMjB0cmFpbmluZyUyMGd5bSUyMHdvcmtvdXR8ZW58MXx8fHwxNzc3OTAzODEzfDA&ixlib=rb-4.1.0&q=80&w=400" },
    { name: "Mariana Alves", role: "Aluna Online", text: "Mesmo de longe, sinto que ele está do meu lado. O app é incrível e os vídeos ajudam muito.", img: "https://images.unsplash.com/photo-1627483262112-039e9a0a0f16?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGZpdCUyMHdvbWFuJTIwZ3ltJTIwd29ya291dCUyMHByb2ZpbGV8ZW58MXx8fHwxNzc3OTAzODEzfDA&ixlib=rb-4.1.0&q=80&w=400" },
    { name: "Ricardo Dias", role: "Aluno Presencial", text: "Foco total em performance. Bati meus recordes pessoais de força em apenas 3 meses.", img: "https://images.unsplash.com/photo-1736264334806-b50e5ec94be1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwcmVzdWx0cyUyMGF0aGxldGUlMjB0cmFuc2Zvcm1hdGlvbnxlbnwxfHx8fDE3Nzc5MDM4MTN8MA&ixlib=rb-4.1.0&q=80&w=400" },
  ];

  return (
    <section className="py-24 bg-zinc-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-lg">
            <h2 className="text-3xl font-black uppercase italic mb-4">Quem treina, <span className="text-lime-400">confia.</span></h2>
            <p className="text-zinc-400 italic">Resultados reais de pessoas comuns que decidiram sair da zona de conforto.</p>
          </div>
          <div className="flex items-center gap-2 text-lime-400 font-bold">
            <Star size={16} fill="currentColor" />
            <Star size={16} fill="currentColor" />
            <Star size={16} fill="currentColor" />
            <Star size={16} fill="currentColor" />
            <Star size={16} fill="currentColor" />
            <span className="text-zinc-500 text-sm ml-2">4.9/5 estrelas</span>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col">
              <div className="w-12 h-12 rounded-full overflow-hidden mb-4 border border-zinc-700">
                <ImageWithFallback src={t.img} alt={t.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-zinc-300 italic mb-6 flex-1">"{t.text}"</p>
              <div>
                <p className="font-bold">{t.name}</p>
                <p className="text-xs text-zinc-500">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTAFinal = () => (
  <section id="contato" className="py-24 relative overflow-hidden">
    {/* Decorative blur */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-lime-400/10 blur-[120px] rounded-full pointer-events-none" />
    
    <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
      <h2 className="text-4xl lg:text-6xl font-black mb-6 uppercase tracking-tight italic">
        PRONTO PARA SUA <br />
        <span className="text-lime-400 italic">MELHOR VERSÃO?</span>
      </h2>
      <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
        As vagas são limitadas para garantir a qualidade do acompanhamento. Não deixe para amanhã o treino que pode mudar sua vida hoje.
      </p>
      <a href="https://wa.me/550000000000?text=Olá João! Quero agendar meu treino." className="inline-block w-full sm:w-auto">
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
        {/* Social Icons Placeholder */}
        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-lime-400 transition-colors cursor-pointer">
          <span className="font-bold text-[10px]">IG</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-lime-400 transition-colors cursor-pointer">
          <span className="font-bold text-[10px]">YT</span>
        </div>
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
      <SocialProof />
      <CTAFinal />
      <Footer />
      
      {/* Floating WA Button (Mobile only or persistent) */}
      <a 
        href="https://wa.me/550000000000" 
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 sm:hidden"
      >
        <MessageCircle size={24} fill="currentColor" />
      </a>
    </div>
  );
}
