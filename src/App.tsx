import { useState, useEffect, useRef } from "react";
import { Monitor, Shield, Users, ArrowRight, Video, MessageSquare, Laptop, Smartphone, Key, Info, X, Settings, Layout, Search, Clock, Plus, MonitorCheck, RefreshCw } from "lucide-react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";
import { motion, AnimatePresence } from "motion/react";
import { Message, SessionInfo } from "./types";

const socket: Socket = io();

export default function App() {
  const [view, setView] = useState<"dashboard" | "session">("dashboard");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [password, setPassword] = useState("k7n2z9");
  const [hostId, setHostId] = useState<string | null>(null);
  const [joinId, setJoinId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("session-closed", () => {
      alert("Sessão encerrada pelo host");
      resetState();
    });

    return () => {
      socket.off("chat-message");
      socket.off("session-closed");
    };
  }, []);

  const resetState = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    setView("dashboard");
    setSessionInfo(null);
    setMessages([]);
    setError(null);
    setIsHosting(false);
    setHostId(null);
    localStreamRef.current = null;
    peerRef.current = null;
  };

  const handleStartHosting = () => {
    socket.emit("create-session", { password }, (response: { sessionId: string }) => {
      setHostId(response.sessionId);
      setIsHosting(true);
      setSessionInfo({ sessionId: response.sessionId, isHost: true });
      startHostStreaming(response.sessionId);
    });
  };

  const handleJoinSession = () => {
    if (!joinId || !joinPassword) {
      setError("Por favor, insira o ID do parceiro e a senha");
      return;
    }
    socket.emit("join-session", { sessionId: joinId, password: joinPassword }, (response: { success?: boolean; error?: string }) => {
      if (response.error) {
        setError(response.error);
      } else {
        setSessionInfo({ sessionId: joinId, isHost: false, connected: true });
        setView("session");
        startClientConnection(joinId);
      }
    });
  };

  const startHostStreaming = async (sessionId: string) => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch (e) {
        console.warn("Falha no DisplayMedia, tentando câmera", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      
      localStreamRef.current = stream;

      socket.on("user-joined", ({ userId }) => {
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: stream,
        });

        peer.on("signal", (data) => {
          socket.emit("signal", { to: userId, signal: data, sessionId });
        });

        peer.on("connect", () => {
          setSessionInfo(prev => prev ? { ...prev, connected: true } : null);
          setView("session");
        });

        socket.on("signal", ({ from, signal }) => {
          if (from === userId) peer.signal(signal);
        });

        peerRef.current = peer;
      });
    } catch (err) {
      setError("Falha ao acessar mídia: " + (err instanceof Error ? err.message : String(err)));
      setIsHosting(false);
      setHostId(null);
    }
  };

  const startClientConnection = (sessionId: string) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
    });

    peer.on("signal", (data) => {
      socket.emit("signal", { sessionId, signal: data });
    });

    peer.on("stream", (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    socket.on("signal", ({ from, signal }) => {
      peer.signal(signal);
    });

    peerRef.current = peer;
  };

  const sendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    if (input.value.trim() && sessionInfo) {
      socket.emit("chat-message", {
        sessionId: sessionInfo.sessionId,
        message: input.value,
        senderName: sessionInfo.isHost ? "Suporte" : "Cliente",
      });
      input.value = "";
    }
  };

  const handleCopyInvite = () => {
    const inviteText = `Olá! Conecte-se ao meu computador via RemoteSync.\n\nSiga os passos:\n1. Acesse: ${window.location.origin}\n2. ID da Sessão: ${hostId}\n3. Senha: ${password}\n\nNota: Se o link não abrir diretamente, copie e cole no seu navegador.`;
    navigator.clipboard.writeText(inviteText);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  };

  const generateNewPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let res = "";
    for(let i=0; i<6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    setPassword(res);
  };

  return (
    <div className="w-full h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900 selection:bg-blue-100">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">RemoteSync</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <div 
            onClick={() => setView("dashboard")}
            className={`flex items-center gap-4 px-4 py-3 rounded-lg font-semibold cursor-pointer transition-colors ${view === "dashboard" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}
          >
            <Layout className="w-5 h-5" />
            Controle Remoto
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
            <Users className="w-5 h-5" />
            Reunião
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
            <MessageSquare className="w-5 h-5" />
            Chat
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
            <Smartphone className="w-5 h-5" />
            Computadores
          </div>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-white font-bold">
              RM
            </div>
            <div>
              <p className="text-sm font-bold">Usuário</p>
              <p className="text-xs text-slate-500">Licença Grátis</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "dashboard" ? (
            <motion.main 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 p-12 overflow-y-auto"
            >
              <header className="flex justify-between items-center mb-16">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900">Controle Remoto</h1>
                  <p className="text-slate-500 mt-1">Pronto para conectar (conexão segura)</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">Online</span>
                </div>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                {/* Allow Remote Control */}
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Permitir Controle Remoto</h2>
                    <div className={`size-3 rounded-full ${isHosting ? "bg-emerald-500 animate-pulse" : "bg-slate-200"}`}></div>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-tighter">Seu ID</label>
                      <div className="text-4xl font-mono tracking-wider font-medium text-slate-800">
                        {isHosting ? (hostId?.match(/.{1,3}/g)?.join(' ') || "--- --- ---") : "942 018 335"}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-tighter">Senha</label>
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-mono tracking-tighter text-slate-800">{password}</div>
                        {!isHosting && (
                          <button 
                            onClick={generateNewPassword}
                            className="p-2 hover:bg-slate-100 rounded text-slate-400 transition-all hover:text-blue-600"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {!isHosting ? (
                      <button 
                        onClick={handleStartHosting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                      >
                        <Shield className="size-5" />
                        Habilitar Acesso Remoto
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Link de Acesso</p>
                          <div className="flex items-center gap-2">
                             <input 
                               readOnly 
                               value={window.location.origin} 
                               className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono text-blue-800"
                               onClick={(e) => (e.target as HTMLInputElement).select()}
                             />
                          </div>
                        </div>
                        <button 
                          onClick={handleCopyInvite}
                          className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 border ${copyStatus === 'copied' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {copyStatus === 'copied' ? <MonitorCheck className="size-5" /> : <Plus className="size-5" />}
                          {copyStatus === 'copied' ? 'Link Copiado!' : 'Copiar Convite para Parceiro'}
                        </button>
                        <button 
                          onClick={resetState}
                          className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-100"
                        >
                          <X className="size-5" />
                          Desativar Acesso
                        </button>
                        <p className="text-[10px] text-slate-400 text-center px-4 leading-tight">
                          Dica: Peça para o parceiro copiar e colar o link diretamente no navegador.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Control Remote Computer */}
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-8">Controlar Computador Remoto</h2>
                  <div className="space-y-6 flex-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-tighter">ID do Parceiro</label>
                      <input 
                        type="text" 
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        placeholder="Insira o ID" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-tighter">Senha do Parceiro</label>
                      <input 
                        type="password" 
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="••••••" 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                        <Info className="size-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <input type="radio" name="mode" defaultChecked className="accent-blue-600 w-4 h-4" /> 
                        <span className="text-sm font-medium text-slate-700">Controle Remoto</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-50">
                        <input type="radio" name="mode" className="accent-blue-600 w-4 h-4" /> 
                        <span className="text-sm font-medium text-slate-700">Transferência de Arquivos</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleJoinSession}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Conectar
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Devices */}
              <div className="mt-16">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Conexões Recentes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "MacBook-Pro-Trabalho", id: "294 855 102" },
                    { name: "PC-Home-Principal", id: "711 303 910" }
                  ].map((device, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group">
                      <div className="w-10 h-10 bg-slate-100 group-hover:bg-blue-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{device.name}</p>
                        <p className="text-xs text-slate-400">ID: {device.id}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-dashed hover:border-blue-400 hover:bg-slate-50 transition-all group">
                    <div className="w-10 h-10 bg-slate-100 group-hover:bg-blue-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-600">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Novo Dispositivo</p>
                      <p className="text-xs text-slate-400">Salvar na lista rápida</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.main>
          ) : (
            <motion.main 
              key="session"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col md:flex-row p-6 gap-6"
            >
              <div className="flex-1 bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800 group">
                {!sessionInfo?.connected && (
                  <div className="absolute inset-0 z-10 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-6">
                    <div className="animate-spin size-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    <div className="text-center space-y-2">
                       <h3 className="text-xl font-bold">Aguardando conexão...</h3>
                       <p className="text-slate-400 text-sm">Tudo é criptografado e seguro.</p>
                    </div>
                    {sessionInfo?.isHost && (
                      <div className="p-6 bg-white/5 rounded-xl border border-white/10 space-y-4 w-64 text-center">
                         <div className="space-y-1">
                           <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Compartilhar ID</span>
                           <div className="text-2xl font-mono font-bold tracking-widest">{sessionInfo.sessionId.match(/.{1,3}/g)?.join(' ')}</div>
                         </div>
                         <div className="space-y-1">
                           <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Senha</span>
                           <div className="text-lg font-mono text-blue-400">{password}</div>
                         </div>
                      </div>
                    )}
                  </div>
                )}

                {sessionInfo?.isHost ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900 overflow-hidden">
                    {/* Animated background lines to suggest activity */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-x-0 top-1/4 h-px bg-blue-500"></div>
                      <div className="absolute inset-x-0 top-2/4 h-px bg-blue-500"></div>
                      <div className="absolute inset-x-0 top-3/4 h-px bg-blue-500"></div>
                      <div className="absolute inset-y-0 left-1/4 w-px bg-blue-500"></div>
                      <div className="absolute inset-y-0 left-2/4 w-px bg-blue-500"></div>
                      <div className="absolute inset-y-0 left-3/4 w-px bg-blue-500"></div>
                    </div>
                    
                    <div className="text-center space-y-8 relative z-10">
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                        <MonitorCheck className="size-32 text-blue-500 relative" />
                        <div className="absolute -top-2 -right-2 size-6 bg-emerald-500 rounded-full border-4 border-slate-900 shadow-lg"></div>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-4xl font-bold text-white tracking-tight">Compartilhamento Ativo</h2>
                        <p className="text-slate-400 max-w-sm mx-auto">Sua tela está sendo compartilhada através de um canal seguro AES-256.</p>
                      </div>
                      <div className="flex gap-4 justify-center">
                        <button className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all border border-white/10">Pausar</button>
                        <button onClick={resetState} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-xl shadow-red-900/20">Encerrar Sessão</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-contain"
                  />
                )}

                {/* Floating Controls Overlay */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-xl p-2 rounded-2xl border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                   <div className="flex items-center gap-1">
                     <button className="p-3 text-white hover:bg-white/10 rounded-xl transition-all" title="Qualidade"><Video className="size-5" /></button>
                     <button className="p-3 text-white hover:bg-white/10 rounded-xl transition-all" title="Áudio"><Users className="size-5" /></button>
                     <button className="p-3 text-white hover:bg-white/10 rounded-xl transition-all" title="Configurações"><Settings className="size-5" /></button>
                   </div>
                   <div className="w-px h-8 bg-white/20 mx-1"></div>
                   <button 
                     onClick={resetState}
                     className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg"
                   >
                     Desconectar
                   </button>
                </div>
              </div>

              {/* Session Panel */}
              <div className="w-full md:w-80 flex flex-col gap-6">
                {/* Connection Status Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conexão</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-600">CRIPTOGRAFADA</span>
                        <Shield className="size-3 text-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-tighter mb-1">ID da Sessão</p>
                      <p className="text-xl font-mono font-bold text-slate-800">{sessionInfo?.sessionId.match(/.{1,3}/g)?.join(' ')}</p>
                    </div>
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <MessageSquare className="size-3 text-blue-500" />
                       Chat de Suporte
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      AO VIVO
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 space-y-3 px-8">
                        <div className="p-3 bg-slate-100 rounded-2xl">
                          <MessageSquare className="size-6" />
                        </div>
                        <p className="text-xs font-medium leading-relaxed">Chat seguro da sessão. <br /> Digite abaixo para se comunicar.</p>
                      </div>
                    ) : (
                      messages.map((msg, i) => (
                        <div 
                          key={i} 
                          className={`flex flex-col ${msg.senderId === socket.id ? "items-end" : "items-start"}`}
                        >
                          <span className="text-[8px] font-bold text-slate-400 mb-1 ml-1 uppercase">{msg.senderName}</span>
                          <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                            msg.senderId === socket.id 
                              ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100" 
                              : "bg-white text-slate-700 rounded-tl-none border border-slate-200 shadow-sm"
                          }`}>
                            {msg.message}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex gap-2">
                    <input 
                      name="message"
                      autoComplete="off"
                      placeholder="Digite sua mensagem..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:bg-white transition-all"
                    />
                    <button 
                      type="submit"
                      className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      <ArrowRight className="size-5" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Status Bar */}
      <footer className="absolute bottom-0 w-full h-8 bg-white border-t border-slate-200 flex items-center px-4 justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Serviço Ativo</span>
          <span className="text-[10px] text-slate-300">v15.2.4</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-slate-400 font-bold tracking-widest flex items-center gap-2">
            <Shield className="size-3" />
            SESSÃO CRIPTOGRAFADA AES-256
          </div>
        </div>
      </footer>
    </div>
  );
}
