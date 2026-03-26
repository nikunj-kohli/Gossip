import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getConnections,
  getIncomingMessageRequests,
  getOutgoingMessageRequests,
  acceptMessageRequest,
  declineMessageRequest,
  cancelMessageRequest,
  removeConnection,
  sendMessageRequest,
  checkMessagingAccessStatus,
  searchUsers,
} from '../api';

const FriendsPage = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [connections, setConnections] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState('connections');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [connectionsRes, incomingRes, outgoingRes] = await Promise.all([
        getConnections(),
        getIncomingMessageRequests(),
        getOutgoingMessageRequests(),
      ]);

      setConnections(Array.isArray(connectionsRes.data) ? connectionsRes.data : []);
      setIncoming(Array.isArray(incomingRes.data) ? incomingRes.data : []);
      setOutgoing(Array.isArray(outgoingRes.data) ? outgoingRes.data : []);
    } catch (error) {
      console.error('Failed loading request center:', error);
      setConnections([]);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const runSearch = async () => {
      const value = query.trim();
      if (!value) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await searchUsers(value);
        if (error) {
          setSearchResults([]);
          return;
        }

        const users = (Array.isArray(data?.users) ? data.users : [])
          .filter((u) => parseInt(u.id, 10) !== parseInt(currentUser?.id, 10));
        const enriched = await Promise.all(users.map(async (u) => {
          try {
            const statusRes = await checkMessagingAccessStatus(u.username);
            const status = statusRes?.data?.status || 'none';
            const direction = statusRes?.data?.direction || null;
            const messagingStatus = status === 'pending' && direction === 'received'
              ? 'pending_received'
              : status;
            return { ...u, messagingStatus };
          } catch (e) {
            return { ...u, messagingStatus: 'none' };
          }
        }));

        setSearchResults(enriched);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const t = setTimeout(runSearch, 250);
    return () => clearTimeout(t);
  }, [query]);

  const onAccept = async (userId) => {
    const { error } = await acceptMessageRequest(userId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to accept request');
      return;
    }
    await loadAll();
  };

  const onDecline = async (userId) => {
    const { error } = await declineMessageRequest(userId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to decline request');
      return;
    }
    await loadAll();
  };

  const onCancel = async (userId) => {
    const { error } = await cancelMessageRequest(userId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to cancel request');
      return;
    }
    await loadAll();
  };

  const onRemove = async (userId) => {
    if (!window.confirm('Remove this connection?')) return;
    const { error } = await removeConnection(userId);
    if (error) {
      alert(error.response?.data?.message || 'Failed to remove connection');
      return;
    }
    await loadAll();
  };

  const onSendRequest = async (userId) => {
    const { error } = await sendMessageRequest(userId);
    if (error) {
      alert(error.response?.data?.message || error.message || 'Failed to send request');
      return;
    }
    await loadAll();
    setSearchResults((prev) => prev.map((u) => (
      u.id === userId ? { ...u, messagingStatus: 'pending' } : u
    )));
  };

  const currentRows = useMemo(() => {
    if (tab === 'incoming') return incoming;
    if (tab === 'outgoing') return outgoing;
    return connections;
  }, [tab, incoming, outgoing, connections]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">Request Center</h1>
        <div className="bg-white rounded-lg border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Send request to message someone
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or display name"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {query.trim() && (
            <div className="mt-4 space-y-2">
              {searching ? (
                <p className="text-sm text-gray-500">Searching...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-gray-500">No users found.</p>
              ) : (
                searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <p className="font-medium text-gray-900">{u.display_name || u.username}</p>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    </div>
                    {u.messagingStatus === 'accepted' ? (
                      <Link to={`/inbox/${u.id}`} className="text-sm bg-green-600 text-white px-3 py-1 rounded-md">
                        Message
                      </Link>
                    ) : u.messagingStatus === 'pending' ? (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span>
                    ) : u.messagingStatus === 'pending_received' ? (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">Check Incoming</span>
                    ) : (
                      <button
                        onClick={() => onSendRequest(u.id)}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
                      >
                        Request
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTab('connections')} className={`px-3 py-1 rounded ${tab === 'connections' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              Connections ({connections.length})
            </button>
            <button onClick={() => setTab('incoming')} className={`px-3 py-1 rounded ${tab === 'incoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              Incoming ({incoming.length})
            </button>
            <button onClick={() => setTab('outgoing')} className={`px-3 py-1 rounded ${tab === 'outgoing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              Outgoing ({outgoing.length})
            </button>
          </div>

          {currentRows.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing here yet.</p>
          ) : (
            <div className="space-y-2">
              {currentRows.map((row) => {
                const userId = row.user_id || row.requester_id || row.addressee_id;
                const name = row.display_name || row.username || 'Unknown';
                const uname = row.username || 'unknown';

                return (
                  <div key={`${tab}-${userId}-${row.friendship_id || row.id || ''}`} className="border rounded-md p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">@{uname}</p>
                    </div>

                    {tab === 'incoming' && (
                      <div className="flex gap-2">
                        <button onClick={() => onAccept(userId)} className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md">Accept</button>
                        <button onClick={() => onDecline(userId)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1 rounded-md">Decline</button>
                      </div>
                    )}

                    {tab === 'outgoing' && (
                      <button onClick={() => onCancel(userId)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-1 rounded-md">Cancel</button>
                    )}

                    {tab === 'connections' && (
                      <div className="flex gap-2">
                        <Link to={`/inbox/${userId}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md">Message</Link>
                        <button onClick={() => onRemove(userId)} className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md">Remove</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FriendsPage;
