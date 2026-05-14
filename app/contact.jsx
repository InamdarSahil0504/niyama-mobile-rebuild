import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/supabase';
import NiyamaIcon from '../src/components/NiyamaIcon';
import { sendSupportReplyNotification } from '../src/notifications';
import { colors, fonts, fontSizes, spacing, radius } from '../src/theme';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --------------------------------------------------------------------------
// Screen
// --------------------------------------------------------------------------

export default function ContactScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    loadMessages();
    setupRealtime();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Scroll to bottom whenever the message list grows
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  async function loadMessages() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error) setMessages(data ?? []);

      // Mark all unread admin messages as seen
      await supabase
        .from('contact_messages')
        .update({ read_by_user: true })
        .eq('user_id', userId)
        .eq('sender', 'admin')
        .eq('read_by_user', false);
    } finally {
      setLoading(false);
    }
  }

  function setupRealtime() {
    const channel = supabase
      .channel(`contact_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contact_messages',
          filter: `user_id=eq.${userId}`,
        },
        async payload => {
          const msg = payload.new;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender === 'admin') {
            // Mark this reply as read immediately (user is looking at the screen)
            await supabase
              .from('contact_messages')
              .update({ read_by_user: true })
              .eq('id', msg.id);
            sendSupportReplyNotification();
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .insert({
          user_id: userId,
          message: text,
          sender: 'user',
          read_by_admin: false,
          read_by_user: true,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    } finally {
      setSending(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  function renderMessage({ item, index }) {
    const isUser = item.sender === 'user';
    const prev = messages[index - 1];
    const showDateHeader =
      !prev || formatDateLabel(prev.created_at) !== formatDateLabel(item.created_at);

    return (
      <View>
        {showDateHeader && (
          <View style={s.dateSep}>
            <View style={s.dateSepLine} />
            <Text style={s.dateSepText}>{formatDateLabel(item.created_at)}</Text>
            <View style={s.dateSepLine} />
          </View>
        )}
        <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAdmin]}>
          {!isUser && <Text style={s.adminLabel}>Niyama</Text>}
          <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAdmin]}>
            <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAdmin]}>
              {item.message}
            </Text>
          </View>
          <Text style={[s.timestamp, isUser ? s.timestampUser : s.timestampAdmin]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------------

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Text style={s.backArrow}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <NiyamaIcon size={26} showBackground={false} />
          <View>
            <Text style={s.headerTitle}>Niyama Support</Text>
            <Text style={s.headerStatus}>Typically replies within 24 hours</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : messages.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💬</Text>
            <Text style={s.emptyTitle}>How can we help?</Text>
            <Text style={s.emptyBody}>
              Send us a message — we typically respond within 24 hours.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* ── Input bar ── */}
        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message Niyama Support…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.sendIcon}>↑</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  backArrow: { fontSize: 34, color: colors.primary, lineHeight: 38, marginTop: -6 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
  headerStatus: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl * 2,
    paddingBottom: spacing.xl,
  },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.lg },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Message list
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  // Date separator
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dateSepText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },

  // Message rows
  msgRow: { marginBottom: spacing.md, maxWidth: '80%' },
  msgRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowAdmin: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  adminLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: 3,
    marginLeft: 4,
  },

  // Bubbles
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAdmin: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    lineHeight: 22,
  },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAdmin: { color: colors.textPrimary },

  // Timestamps
  timestamp: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  timestampUser: { marginRight: 2 },
  timestampAdmin: { marginLeft: 4 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    maxHeight: 120,
    lineHeight: 22,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : spacing.xs,
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    lineHeight: 24,
    marginTop: -2,
  },
});
