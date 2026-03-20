import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const DashboardPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  const sampleConversations = [
    {
      id: 1,
      name: 'Avery Green',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8RB5FXjfMsI2fYm0WFhiVNvSr2sWf5MWt1D7lTyhUKpE6oAV_idY3BpPb35p9RpYbt-0_roCs_gZumOEdwmyUcDCxhfmfrK0LGQBP7Xt2en-IjN3a6UiQaNW1DtzvDNhJ9N5PJ-sG1mpvDIxYhLFueaObDVc-3wp_sYXDGxnXCwpT40RLi_gjCsFVwuFedv5CUddo-BZ48BMWn-zKKCfN7A28-s2akT3Vrzx-i1k7Y45pcVtrTJA6jklpikei1w7UaG9twNKbgt4',
      lastMessage: 'Wait, did you hear about the...',
      time: 'Now',
      online: true,
      unread: 0
    },
    {
      id: 2,
      name: 'Jordan Vance',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaCzJAe5DBYAoVcH9h-Qu3Z3SQzyNgK2ZAl9lCK0zCibLCcACZOLAYxEqV5n8hPWiwDm_3DMDnbV1_ngf-mf7xKGpqGPkRX3_tqpqgZ7MdUpxVsHXB4ST4hn_qRyJ4c15cVOtJaeQaizgPppePSfJcpsgYnbX_im21ohlGa5ToN0n0Pcg2rOJ5jYvQ9KNtPUJMIq0CvMCHx7clqBF_zrrT-wG9Y2SI87wbhu57lQSgtR9Wm0ozWIFYG9nkFUePc9uJIoSa7Pb1DMI',
      lastMessage: "That's actually wild. I had no idea.",
      time: '15m',
      online: false,
      unread: 0
    },
    {
      id: 3,
      name: 'Sloane Smith',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDHA-cKHeG6evpk3pj3648kGvnn_leYzF_e6beNzT0OR14LCAt75wHiacjOs5Uo9-FUh5tj1tIOBDt9ebpGd6B48eaA4cIYQNxTYHB5DQQL7bKTeCXfCGB97wCITdlKkKn87MVGn9TBlQetvYRYJkI9OrHBuH8q3HF9_M9ZtUnbeMujme4PREaJxqJ8JhupzJ_ZW4-lPEF8PkBn2aUmjBY9EhojG9N06lGRI3GbhgfXUh8TXh9Tf1zwpw8YnRm0e5y1ZfByv8qTE0w',
      lastMessage: 'Sent an attachment',
      time: '2h',
      online: false,
      unread: 0
    },
    {
      id: 4,
      name: 'Marcus Chen',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbu6w9F42KI7ozlZ4e_VjaLUioKY6fTFsN6fwstB73c03e8l2r_4kYEGxuAPbA681nHc15l9ZEjWR78mytk2l45M4XUu5fFp8_daR6EF_nd4wrzOUr0tIaPOUJdHw6juCRc6FVdTuuDgbdWVhBTYyGIdptvqJtGGoeBrQaXs93VLX74gGsKdI1FckPCDpXLNvODhsZ-mO742P9DnFGXWg1fP8pLu_JrYNU4_PkLPkcwBqfAHyjYjBy-RXiwsk7N99XUhWdGQmBr9I',
      lastMessage: 'See you at the studio later.',
      time: 'Yesterday',
      online: false,
      unread: 0
    }
  ];

  const sampleMessages = [
    {
      id: 1,
      sender: 'Avery Green',
      content: 'Wait, did you hear about the new gallery opening in the industrial district? Apparently it\'s invite-only.',
      time: '11:24 AM',
      type: 'received'
    },
    {
      id: 2,
      sender: 'You',
      content: 'No way! I thought they pushed the date to next month. Who\'s the curator?',
      time: '11:26 AM',
      type: 'sent'
    },
    {
      id: 3,
      sender: 'Avery Green',
      content: 'It\'s that minimalist collective. Look at this space...',
      time: '11:27 AM',
      type: 'received',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuX_ScoN3pqO9ondLEGb0SGFmq6Z1mRzwDhldUScrm_HQsLr-bIf1GpFjJLk5-uD6dvYMTzX1eR5GmpmP3L56TNn2s02VFTOnAMlyQpTRuTQXM4pjsZppiLnUe9-YIa7O2RPXq73KZevnMNZGOgTEBnmc5DSVMMimNh3ntgGH8LlZ9OXcHuusSKdLGOzSmuhZg9IJ5W-my2-s6bUXqEhffgDLgd4aunnpB4O8MZE9rJ2HY-NcEpBoNJs9iNesPz191_ZaCzZIdOXI'
    },
    {
      id: 4,
      sender: 'You',
      content: 'Stunning. We definitely need to get in.',
      time: '11:30 AM',
      type: 'sent'
    }
  ];

  const sharedMedia = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAZGs5M18VcJpEhUChWaf1ms_KtygKZBQjkMwBGKVDFDpeCUYtf-d616kNSI6ULRoJj1u9mmq6-fCWArYWXre0oACJWPUb6vqQxtxubomnVSIEzH7Vq9Vx_4G3JFUaJ0BNwUCLl9Ahb_VmMocaneP1AIgCkbRKRdYw1sFyBRMqHeUtMKIxWSKgsYLbVxiqkd9YcohXBiXHme_4uCjQmFvRcZ_sWQ_XeC1TxOeKQR0zUpAG-hPjIYmj0WOMAk4Sn51iO6os4d6qnDkY',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAx6l5hNEqxN1nGByL0BQtzDA-N7jvdFQ_B-W2ou9oXPyvKbJCOblOiQUcRw55u7FczLeR1ZiAZrBNpIZNB9KIW_oYSKUxBlH5WoS6ixoTgBjnE-QUNX-FgGXyk0llNh1Ng_8Kc86FUoU9zZ9D9Mtdusph-06VJhZc1z8LCdZ6T3ukTj3wGN77xgdI6zfXDpfyGP-ZilrV1Vq_FuM5IVzwbFOZ-s-Y6CSotn8tbAwFIR9ShTaL65X9eLb3fYS4_xgFNJFhwtk7fHJE',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBDw3xTfyevskd1N62WFXuvAjuUO2EWe410HxkzrtKOK_Mdkp4w79ImsUmr2I0mOXuGWru8PnPwQBZwVKKGk-wPsFcyWxSOfGGM0GnpmYVdIPodmcLSHGXBlQLUsuZdtcHfl_X-CXO5K05hGH-vPfDkQawDNFkXNSqkmUcw7kJAKbTQ1mFG6q5sCN1J6KPVLp4as7O3FS0DgNwpSjoAeriHIVIzYxCXYy7h6g-94vEW5NTL3JBn1ogXw9rvWvV-pWtWW5qHY0kyWUc'
  ];

  const commonGroups = [
    { name: 'Design Reviewers', icon: 'palette' },
    { name: 'Morning Brew Crew', icon: 'coffee' }
  ];

  useEffect(() => {
    setConversations(sampleConversations);
    if (sampleConversations.length > 0) {
      setActiveChat(sampleConversations[0]);
      setMessages(sampleMessages);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const newMsg = {
      id: messages.length + 1,
      sender: 'You',
      content: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'sent'
    };

    try {
      // Replace with actual API call
      // await fetch('/api/messages', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ 
      //     conversationId: activeChat.id, 
      //     content: newMessage 
      //   })
      // });

      setMessages([...messages, newMsg]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-background-dark">
      {/* Sidebar / Inbox List */}
      <aside className="w-80 flex-shrink-0 border-r border-sage-200 dark:border-sage-500/20 bg-white dark:bg-background-dark flex flex-col">
        <div className="p-6 border-b border-sage-100 dark:border-sage-500/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">filter_vintage</span>
              <h1 className="text-xl font-semibold tracking-tight">Whisper</h1>
            </div>
            <button className="p-2 rounded-full bg-sage-50 hover:bg-sage-100 transition-colors">
              <span className="material-symbols-outlined text-sage-500">edit_square</span>
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sage-400 text-xl">search</span>
            <input 
              className="w-full bg-sage-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/30 placeholder:text-sage-400" 
              placeholder="Search conversations..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          {filteredConversations.map(conversation => (
            <div 
              key={conversation.id}
              onClick={() => {
                setActiveChat(conversation);
                setMessages(sampleMessages);
              }}
              className={`px-4 mb-1 cursor-pointer ${
                activeChat?.id === conversation.id ? '' : 'hover:bg-sage-50 transition-colors'
              }`}
            >
              <div className={`flex items-center gap-4 p-3 rounded-xl ${
                activeChat?.id === conversation.id 
                  ? 'bg-primary/10 border border-primary/5' 
                  : ''
              }`}>
                <div className="relative">
                  <div className="size-12 rounded-full bg-sage-200 overflow-hidden">
                    <img 
                      src={conversation.avatar} 
                      alt={conversation.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {conversation.online && (
                    <div className="absolute bottom-0 right-0 size-3 bg-primary border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-medium text-sm truncate">{conversation.name}</h3>
                    <span className={`text-[10px] font-semibold uppercase ${
                      conversation.time === 'Now' ? 'text-primary' : 'text-slate-400'
                    }`}>
                      {conversation.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{conversation.lastMessage}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col bg-white dark:bg-background-dark relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-sage-100 dark:border-sage-500/10 flex items-center justify-between px-8">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-sage-100 overflow-hidden">
                  <img 
                    src={activeChat.avatar} 
                    alt={activeChat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-semibold text-base">{activeChat.name}</h2>
                  <p className="text-xs text-primary font-medium">
                    {activeChat.online ? 'Online now' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 text-sage-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">call</span>
                </button>
                <button className="p-2 text-sage-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">videocam</span>
                </button>
                <button className="p-2 text-sage-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </header>

            {/* Messages Flow */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="flex justify-center">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-sage-50 px-3 py-1 rounded-full">Today</span>
              </div>
              
              {messages.map(message => (
                <div 
                  key={message.id}
                  className={`flex gap-3 max-w-lg ${
                    message.type === 'sent' ? 'flex-row-reverse ml-auto' : ''
                  }`}
                >
                  {message.type === 'received' && (
                    <div className="size-8 rounded-full flex-shrink-0 mt-1 overflow-hidden">
                      <img 
                        src={activeChat.avatar} 
                        alt={activeChat.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className={`space-y-1 ${message.type === 'sent' ? 'items-end flex flex-col' : ''}`}>
                    <div className={`${
                      message.type === 'sent' 
                        ? 'bg-primary text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md shadow-primary/10'
                        : 'bg-sage-50 text-slate-700 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    
                    {message.image && (
                      <div className={`rounded-xl overflow-hidden border border-sage-100 max-w-xs ${
                        message.type === 'sent' ? 'ml-auto' : ''
                      }`}>
                        <img 
                          src={message.image} 
                          alt="Shared image"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <span className="text-[10px] text-slate-400 px-1">{message.time}</span>
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-6">
              <div className="bg-sage-50 rounded-2xl p-2 flex items-center gap-2">
                <button className="p-2 text-sage-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 placeholder:text-sage-400" 
                  placeholder="Whisper something..." 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button className="p-2 text-sage-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">mood</span>
                </button>
                <button 
                  onClick={handleSendMessage}
                  className="bg-primary text-white size-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-sage-300 mb-4">chat_bubble</span>
              <p className="text-slate-500">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </main>

      {/* Details Sidebar */}
      {activeChat && (
        <aside className="w-72 flex-shrink-0 border-l border-sage-100 dark:border-sage-500/10 bg-white dark:bg-background-dark overflow-y-auto hidden xl:flex flex-col">
          <div className="p-8 text-center flex flex-col items-center">
            <div className="size-24 rounded-full bg-sage-50 p-1 mb-4">
              <div className="size-full rounded-full overflow-hidden">
                <img 
                  src={activeChat.avatar} 
                  alt={activeChat.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-lg font-semibold">{activeChat.name}</h3>
            <p className="text-xs text-slate-400 mt-1">Creative Director @ ZenStudio</p>
            <div className="flex gap-4 mt-6">
              <button className="size-10 flex items-center justify-center rounded-full bg-sage-50 text-sage-500 hover:bg-sage-100 transition-colors">
                <span className="material-symbols-outlined text-xl">person</span>
              </button>
              <button className="size-10 flex items-center justify-center rounded-full bg-sage-50 text-sage-500 hover:bg-sage-100 transition-colors">
                <span className="material-symbols-outlined text-xl">notifications_off</span>
              </button>
              <button className="size-10 flex items-center justify-center rounded-full bg-sage-50 text-sage-500 hover:bg-sage-100 transition-colors">
                <span className="material-symbols-outlined text-xl">block</span>
              </button>
            </div>
          </div>
          
          <div className="px-6 py-4 space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Shared Media</h4>
              <div className="grid grid-cols-3 gap-2">
                {sharedMedia.map((media, index) => (
                  <div key={index} className="aspect-square bg-sage-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                    <img 
                      src={media} 
                      alt={`Shared image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                <div className="aspect-square bg-sage-50 rounded-lg flex items-center justify-center text-sage-400 text-xs font-medium cursor-pointer hover:bg-sage-100 transition-colors">
                  +12
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Common Groups</h4>
              <div className="space-y-3">
                {commonGroups.map((group, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-sage-100 flex items-center justify-center text-sage-500">
                      <span className="material-symbols-outlined text-lg">{group.icon}</span>
                    </div>
                    <span className="text-sm font-medium">{group.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default DashboardPage;
