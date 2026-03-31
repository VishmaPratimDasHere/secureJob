import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function Messages() {
    const { user, token } = useAuth()
    const [conversations, setConversations] = useState([])
    const [activeConv, setActiveConv] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMsg, setNewMsg] = useState('')
    const [sending, setSending] = useState(false)

    // New conversation
    const [showNewConv, setShowNewConv] = useState(false)
    const [userSearch, setUserSearch] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [selectedUsers, setSelectedUsers] = useState([])
    const [groupTitle, setGroupTitle] = useState('')

    const bottomRef = useRef(null)
    const pollRef = useRef(null)

    const headers = { Authorization: `Bearer ${token}` }
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

    const fetchConversations = async () => {
        try {
            const res = await fetch('/api/messages/conversations', { headers })
            if (res.ok) setConversations(await res.json())
        } catch { /* network error */ }
    }

    const fetchMessages = async (convId) => {
        try {
            const res = await fetch(`/api/messages/conversations/${convId}/messages`, { headers })
            if (res.ok) setMessages(await res.json())
        } catch { /* network error */ }
    }

    useEffect(() => {
        if (token) fetchConversations()
    }, [token])

    useEffect(() => {
        if (activeConv) {
            fetchMessages(activeConv.id)
            pollRef.current = setInterval(() => fetchMessages(activeConv.id), 5000)
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [activeConv])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const searchUsers = async (q) => {
        setUserSearch(q)
        if (q.length < 2) { setSearchResults([]); return }
        const res = await fetch(`/api/messages/users?q=${encodeURIComponent(q)}`, { headers })
        if (res.ok) setSearchResults(await res.json())
    }

    const startConversation = async () => {
        if (selectedUsers.length === 0) return
        const isGroup = selectedUsers.length > 1
        try {
            const res = await fetch('/api/messages/conversations', {
                method: 'POST', headers: jsonHeaders,
                body: JSON.stringify({
                    member_ids: selectedUsers.map(u => u.id),
                    title: isGroup ? groupTitle : '',
                    is_group: isGroup,
                })
            })
            if (res.ok) {
                const conv = await res.json()
                await fetchConversations()
                setActiveConv(conv)
                setShowNewConv(false)
                setSelectedUsers([])
                setGroupTitle('')
                setUserSearch('')
            }
        } catch { /* network error */ }
    }

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!newMsg.trim() || !activeConv) return
        setSending(true)
        try {
            const res = await fetch(`/api/messages/conversations/${activeConv.id}/messages`, {
                method: 'POST', headers: jsonHeaders,
                body: JSON.stringify({ body: newMsg.trim() })
            })
            if (res.ok) {
                setNewMsg('')
                await fetchMessages(activeConv.id)
                fetchConversations()
            }
        } catch { /* network error */ }
        setSending(false)
    }

    const getConvName = (conv) => {
        if (conv.is_group) return conv.title || 'Group Chat'
        const otherNames = conv.member_names.filter((_, i) => conv.member_ids[i] !== user.id)
        return otherNames[0] || 'Chat'
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-heading">Messages</h1>
                    <p className="text-foreground/60 text-sm">End-to-end encrypted conversations</p>
                </div>
                <Button onClick={() => setShowNewConv(!showNewConv)}>
                    {showNewConv ? 'Cancel' : 'New Conversation'}
                </Button>
            </div>

            {/* New Conversation */}
            {showNewConv && (
                <Card className="mb-6 bg-main">
                    <CardHeader>
                        <CardTitle>Start a Conversation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Search Users</Label>
                            <Input
                                placeholder="Type a name or username..."
                                value={userSearch}
                                onChange={e => searchUsers(e.target.value)}
                            />
                            {searchResults.length > 0 && (
                                <div className="border-2 border-border rounded-base bg-background max-h-40 overflow-y-auto">
                                    {searchResults.map(u => (
                                        <button
                                            key={u.id}
                                            className="w-full text-left px-3 py-2 hover:bg-secondary-background text-sm border-b border-border/30"
                                            onClick={() => {
                                                if (!selectedUsers.find(s => s.id === u.id)) {
                                                    setSelectedUsers([...selectedUsers, u])
                                                }
                                                setSearchResults([])
                                                setUserSearch('')
                                            }}
                                        >
                                            <span className="font-heading">{u.full_name}</span>
                                            <span className="text-foreground/50 ml-2">@{u.username}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedUsers.map(u => (
                                    <Badge key={u.id} variant="neutral" className="cursor-pointer" onClick={() => setSelectedUsers(selectedUsers.filter(s => s.id !== u.id))}>
                                        {u.full_name} &times;
                                    </Badge>
                                ))}
                            </div>
                        )}
                        {selectedUsers.length > 1 && (
                            <div className="space-y-2">
                                <Label>Group Name</Label>
                                <Input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} placeholder="Optional group name" />
                            </div>
                        )}
                        <Button onClick={startConversation} disabled={selectedUsers.length === 0}>Start Chat</Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: '60vh' }}>
                {/* Conversation List */}
                <Card className="md:col-span-1 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Conversations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {conversations.length === 0 ? (
                            <p className="text-sm text-foreground/60 p-4">No conversations yet</p>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        className={`w-full text-left px-4 py-3 hover:bg-secondary-background transition-colors ${activeConv?.id === conv.id ? 'bg-secondary-background' : ''}`}
                                        onClick={() => setActiveConv(conv)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-heading text-sm truncate">{getConvName(conv)}</span>
                                            {conv.is_group && <Badge className="text-xs shrink-0 ml-2">Group</Badge>}
                                        </div>
                                        {conv.last_message && (
                                            <p className="text-xs text-foreground/50 truncate mt-1">
                                                {conv.last_message.sender_name}: {conv.last_message.body}
                                            </p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Chat Area */}
                <Card className="md:col-span-2 flex flex-col overflow-hidden">
                    {activeConv ? (
                        <>
                            <CardHeader className="pb-2 border-b-2 border-border">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{getConvName(activeConv)}</CardTitle>
                                    <Badge variant="neutral" className="text-xs">Encrypted</Badge>
                                </div>
                                {activeConv.is_group && (
                                    <CardDescription className="text-xs">
                                        {activeConv.member_names.join(', ')}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '50vh' }}>
                                {messages.map(msg => {
                                    const isMine = msg.sender_id === user.id
                                    return (
                                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-base border-2 border-border px-3 py-2 ${isMine ? 'bg-main' : 'bg-secondary-background'}`}>
                                                {!isMine && <p className="text-xs font-heading mb-1">{msg.sender_name}</p>}
                                                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                                                <p className="text-xs text-foreground/40 mt-1 text-right">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={bottomRef} />
                            </CardContent>
                            <div className="p-3 border-t-2 border-border">
                                <form onSubmit={sendMessage} className="flex gap-2">
                                    <Input
                                        className="flex-1"
                                        placeholder="Type a message..."
                                        value={newMsg}
                                        onChange={e => setNewMsg(e.target.value)}
                                    />
                                    <Button type="submit" disabled={sending || !newMsg.trim()}>Send</Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <CardContent className="flex-1 flex items-center justify-center">
                            <p className="text-foreground/50 font-heading">Select a conversation or start a new one</p>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    )
}
