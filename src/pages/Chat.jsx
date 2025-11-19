import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Users } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Chat() {
  const [activeChannel, setActiveChannel] = useState('Telekom');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ['chatMessages', activeChannel],
    queryFn: () => base44.entities.ChatMessage.filter({ channel: activeChannel }, '-created_date', 100),
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => base44.entities.ChatMessage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['chatMessages', activeChannel]);
      setMessage('');
    },
  });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    sendMessageMutation.mutate({
      channel: activeChannel,
      sender_name: user.full_name || user.email,
      sender_email: user.email,
      message: message.trim(),
      timestamp: new Date().toISOString()
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const channels = [
    { name: 'Telekom', color: 'from-pink-500 to-rose-500', badge: 'bg-pink-100 text-pink-800' },
    { name: '1&1 Versatel', color: 'from-blue-500 to-cyan-500', badge: 'bg-blue-100 text-blue-800' },
    { name: 'Backoffice', color: 'from-purple-500 to-indigo-500', badge: 'bg-purple-100 text-purple-800' }
  ];

  const activeChannelInfo = channels.find(c => c.name === activeChannel);

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = new Date(msg.created_date).toLocaleDateString('de-DE');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Team Chat</h1>
        <p className="text-slate-500 mt-1">Kommunizieren Sie mit Ihrem Team nach Sparten</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Channels Sidebar */}
        <Card className="border-0 shadow-md lg:col-span-1">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Kanäle
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.name}
                  onClick={() => setActiveChannel(channel.name)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                    activeChannel === channel.name
                      ? `bg-gradient-to-r ${channel.color} text-white shadow-lg`
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{channel.name}</span>
                    <MessageSquare className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="border-0 shadow-md lg:col-span-3 flex flex-col h-[calc(100vh-16rem)]">
          <CardHeader className={`border-b border-slate-100 bg-gradient-to-r ${activeChannelInfo?.color} text-white`}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {activeChannel}
              </CardTitle>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {messages.length} Nachrichten
              </Badge>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <MessageSquare className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">Noch keine Nachrichten</p>
                <p className="text-sm">Starten Sie die Konversation!</p>
              </div>
            ) : (
              Object.entries(groupedMessages).reverse().map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      {date}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-4">
                    {msgs.reverse().map((msg) => {
                      const isOwnMessage = user && msg.sender_email === user.email;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                            {!isOwnMessage && (
                              <p className="text-xs font-semibold text-slate-700 mb-1 px-1">
                                {msg.sender_name}
                              </p>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-3 ${
                                isOwnMessage
                                  ? `bg-gradient-to-r ${activeChannelInfo?.color} text-white`
                                  : 'bg-slate-100 text-slate-900'
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.message}
                              </p>
                            </div>
                            <p className={`text-xs text-slate-400 mt-1 px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                              {format(new Date(msg.created_date), 'HH:mm', { locale: de })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Message Input */}
          <div className="border-t border-slate-100 p-4">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nachricht eingeben..."
                className="flex-1"
                disabled={!user}
              />
              <Button
                type="submit"
                disabled={!message.trim() || !user}
                className={`bg-gradient-to-r ${activeChannelInfo?.color} hover:opacity-90`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}